// ---------------------------------------------------------------------------
// Supabase de mentira, em memória. Serve para rodar o route.ts DE VERDADE nos
// testes: ele é o espelho manual da lógica local, e sem exercitar o código real
// um erro de digitação (coluna errada, filtro de edição esquecido, await
// faltando) só apareceria no dia do evento.
//
// Implementa o pedaço do PostgREST que a rota usa: select/insert/update/delete
// com eq/neq/in, order, limit, maybeSingle e upsert.
// ---------------------------------------------------------------------------

type Linha = Record<string, any>;

interface Filtro {
  tipo: "eq" | "neq" | "in";
  coluna: string;
  valor: any;
}

let seq = 0;
const novoId = () => `id-${(++seq).toString().padStart(4, "0")}`;

export interface BancoFake {
  players: Linha[];
  matches: Linha[];
  config: Linha[];
  editions: Linha[];
}

/** Colunas com default no schema — o insert não precisa informar. */
const DEFAULTS: Record<string, () => Linha> = {
  players: () => ({
    id: novoId(),
    created_at: new Date().toISOString(),
    photo: null,
    edition: 1,
    withdrawn: false,
  }),
  matches: () => ({
    id: novoId(),
    created_at: new Date().toISOString(),
    stage: "liga",
    round: null,
    home_id: null,
    away_id: null,
    home_goals: null,
    away_goals: null,
    pen_winner_id: null,
    counts_for_scorers: true,
    slot: null,
    edition: 1,
  }),
  editions: () => ({
    id: 1,
    name: "Copa Costela",
    event_date: null,
    event_time: null,
    event_local: null,
    event_note: null,
    created_at: new Date().toISOString(),
    closed_at: null,
  }),
  config: () => ({}),
};

class Query implements PromiseLike<{ data: any; error: any }> {
  private filtros: Filtro[] = [];
  private op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private payload: any = null;
  private ordenar: { coluna: string; asc: boolean } | null = null;
  private limite: number | null = null;
  private unico = false;

  constructor(
    private banco: BancoFake,
    private tabela: keyof BancoFake,
    private colunasConhecidas: Set<string>,
  ) {}

  select(_cols?: string) {
    if (this.op === "select") this.op = "select";
    return this;
  }
  insert(rows: Linha | Linha[]) {
    this.op = "insert";
    this.payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }
  upsert(row: Linha) {
    this.op = "upsert";
    this.payload = row;
    return this;
  }
  update(patch: Linha) {
    this.op = "update";
    this.payload = patch;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  eq(coluna: string, valor: any) {
    this.filtros.push({ tipo: "eq", coluna, valor });
    return this;
  }
  neq(coluna: string, valor: any) {
    this.filtros.push({ tipo: "neq", coluna, valor });
    return this;
  }
  in(coluna: string, valor: any[]) {
    this.filtros.push({ tipo: "in", coluna, valor });
    return this;
  }
  order(coluna: string, opts?: { ascending?: boolean }) {
    this.ordenar = { coluna, asc: opts?.ascending !== false };
    return this;
  }
  limit(n: number) {
    this.limite = n;
    return this;
  }
  maybeSingle() {
    this.unico = true;
    return this;
  }

  private casa(linha: Linha) {
    return this.filtros.every((f) => {
      if (f.tipo === "eq") return linha[f.coluna] === f.valor;
      if (f.tipo === "neq") return linha[f.coluna] !== f.valor;
      return (f.valor as any[]).includes(linha[f.coluna]);
    });
  }

  /** Recusa coluna inexistente, como o Postgres faria. */
  private validar(obj: Linha) {
    for (const k of Object.keys(obj)) {
      if (!this.colunasConhecidas.has(k)) {
        throw new Error(`coluna "${k}" não existe em ${String(this.tabela)}`);
      }
    }
  }

  private executar() {
    const tab = this.banco[this.tabela];

    if (this.op === "insert") {
      const criadas = (this.payload as Linha[]).map((r) => {
        this.validar(r);
        return { ...DEFAULTS[this.tabela](), ...r };
      });
      tab.push(...criadas);
      return { data: criadas, error: null };
    }

    if (this.op === "upsert") {
      this.validar(this.payload);
      const i = tab.findIndex((l) => l.id === this.payload.id);
      if (i >= 0) tab[i] = { ...tab[i], ...this.payload };
      else tab.push({ ...DEFAULTS[this.tabela](), ...this.payload });
      return { data: [this.payload], error: null };
    }

    if (this.op === "update") {
      this.validar(this.payload);
      const alvos = tab.filter((l) => this.casa(l));
      for (const l of alvos) Object.assign(l, this.payload);
      return { data: alvos, error: null };
    }

    if (this.op === "delete") {
      const restam = tab.filter((l) => !this.casa(l));
      const apagadas = tab.filter((l) => this.casa(l));
      this.banco[this.tabela] = restam as any;
      return { data: apagadas, error: null };
    }

    let linhas = tab.filter((l) => this.casa(l));
    if (this.ordenar) {
      const { coluna, asc } = this.ordenar;
      linhas = [...linhas].sort((a, b) =>
        a[coluna] === b[coluna] ? 0 : (a[coluna] > b[coluna] ? 1 : -1) * (asc ? 1 : -1),
      );
    }
    if (this.limite != null) linhas = linhas.slice(0, this.limite);
    if (this.unico) return { data: linhas[0] ?? null, error: null };
    return { data: linhas, error: null };
  }

  then<R1 = any, R2 = never>(
    ok?: ((v: { data: any; error: any }) => R1 | PromiseLike<R1>) | null,
    err?: ((r: any) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    try {
      return Promise.resolve(this.executar()).then(ok, err);
    } catch (e: any) {
      // erro de coluna vira {error}, como o supabase-js devolve
      return Promise.resolve({ data: null, error: { message: e.message } }).then(ok as any, err);
    }
  }
}

const COLUNAS: Record<keyof BancoFake, string[]> = {
  players: ["id", "name", "created_at", "photo", "edition", "withdrawn"],
  matches: [
    "id", "stage", "round", "home_id", "away_id", "home_goals", "away_goals",
    "pen_winner_id", "counts_for_scorers", "slot", "created_at", "edition",
  ],
  config: ["id", "tournament_name", "phase", "bracket_seeded", "current_edition"],
  editions: [
    "id", "name", "event_date", "event_time", "event_local", "event_note",
    "created_at", "closed_at",
  ],
};

/** Banco novo, já com a linha de config e a 1ª edição, como o schema cria. */
export function criarBanco(players: { name: string; edition?: number }[] = []): BancoFake {
  const banco: BancoFake = {
    players: [],
    matches: [],
    config: [
      {
        id: 1,
        tournament_name: "Copa Costela",
        phase: "liga",
        bracket_seeded: false,
        current_edition: 1,
      },
    ],
    editions: [{ ...DEFAULTS.editions(), id: 1 }],
  };
  players.forEach((p, i) =>
    banco.players.push({
      ...DEFAULTS.players(),
      name: p.name,
      edition: p.edition ?? 1,
      created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
    }),
  );
  return banco;
}

export function clienteFake(banco: BancoFake) {
  return {
    from(tabela: keyof BancoFake) {
      if (!banco[tabela]) throw new Error(`tabela "${String(tabela)}" não existe`);
      return new Query(banco, tabela, new Set(COLUNAS[tabela]));
    },
  };
}
