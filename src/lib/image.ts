"use client";

/**
 * Lê um arquivo de imagem, recorta em quadrado (centralizado) e devolve um
 * data URI JPEG pequeno (~256px) — leve o suficiente para guardar no banco.
 */
export function fileToAvatarDataUrl(file: File, size = 256, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Selecione um arquivo de imagem."));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não consegui ler o arquivo."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Imagem inválida."));
      img.onload = () => {
        const s = Math.min(img.width, img.height);
        const sx = (img.width - s) / 2;
        const sy = (img.height - s) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Falha ao processar a imagem."));
          return;
        }
        ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
