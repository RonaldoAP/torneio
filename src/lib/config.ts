// Trava de edição durante a divulgação.
// Com SITE_LOCKED = true, o /admin só permite gerenciar participantes;
// sorteio, placares, mata-mata, desistência e backup ficam bloqueados.
// Para liberar tudo de novo, troque para false e faça deploy.
export const SITE_LOCKED = true;

// Informações do evento (exibidas no regulamento e na tela TV).
export const EVENT = {
  date: "18 de julho",
  time: "10h",
  local: "Casa do Léo",
  note: "Sorteio às 10h em ponto — todos presentes. Quem for sorteado e não estiver, perde por W.O.",
  slots: 12,
};
