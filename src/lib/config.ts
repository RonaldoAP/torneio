// Trava de edição durante a divulgação.
// Com SITE_LOCKED = true, o /admin só permite gerenciar participantes;
// sorteio, placares, mata-mata, desistência e backup ficam bloqueados.
// Para liberar tudo de novo, troque para false e faça deploy.
export const SITE_LOCKED = true;

// Informações do evento (exibidas no regulamento e na tela TV).
export const EVENT = {
  date: "18 de julho",
  time: "9h da manhã",
  local: "Casa do Léo",
  note: "São cerca de 10h de jogo corrido — por isso começamos cedo!",
  slots: 12,
};
