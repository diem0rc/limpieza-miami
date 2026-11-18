/**
 * Redimensiona y comprime una foto EN EL NAVEGADOR, antes de subirla.
 *
 * Dos motivos, los dos duros:
 *
 * 1. **Las funciones de Vercel rechazan cuerpos de más de 4,5 MB.** Una foto
 *    de un teléfono actual ronda los 3–6 MB, así que subirla tal cual falla a
 *    veces sí y a veces no, según el teléfono — el peor tipo de error.
 * 2. **Esas fotos acaban en la home**, que es la página que recibe el tráfico
 *    de los códigos QR, desde datos móviles. Mandar 5 MB de foto a alguien
 *    parado en la calle es tirarle la página encima.
 *
 * Después de esto, una foto típica queda entre 100 y 300 KB sin que se note a
 * simple vista en un teléfono.
 *
 * Se hace con canvas y nada más: sin dependencias nuevas y sin gastar CPU del
 * servidor.
 */

export interface ResizedImage {
  blob: Blob;
  width: number;
  height: number;
}

/** El lado largo máximo. Suficiente para verse nítida en cualquier pantalla. */
const MAX_SIDE = 1600;

/**
 * Decodifica el archivo respetando la orientación EXIF.
 *
 * Importa mucho más de lo que parece: una foto tomada en vertical con un
 * iPhone se guarda girada, con una etiqueta EXIF que dice cómo enderezarla.
 * Un `<canvas>` dibuja los píxeles crudos, así que sin tratar esa etiqueta las
 * fotos verticales aparecerían acostadas en la web.
 *
 * `createImageBitmap` con `imageOrientation: "from-image"` lo resuelve donde
 * existe. Donde no, se cae a una `<img>`, que los navegadores actuales ya
 * enderezan solas al decodificar.
 */
async function decodificar(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Formato que esta vía no sabe decodificar: se intenta con la otra.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("no se pudo decodificar"));
      img.src = url;
    });
  } finally {
    // Se revoca en cuanto la imagen está decodificada: sin esto, cada foto
    // elegida deja su copia retenida en memoria hasta recargar la página.
    URL.revokeObjectURL(url);
  }
}

function medidas(fuente: ImageBitmap | HTMLImageElement) {
  const w = "naturalWidth" in fuente ? fuente.naturalWidth : fuente.width;
  const h = "naturalHeight" in fuente ? fuente.naturalHeight : fuente.height;
  return { w, h };
}

/**
 * Pide un blob al canvas con el tipo que se le diga.
 *
 * `toBlob` tiene una trampa: si el navegador no sabe codificar el tipo pedido,
 * NO falla — devuelve un PNG sin avisar. Un PNG de una foto pesa varias veces
 * más que el JPEG original, o sea lo contrario de lo que buscamos. Por eso
 * quien llama compara `blob.type` con lo que pidió.
 */
function aBlob(canvas: HTMLCanvasElement, type: string, calidad: number) {
  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, calidad),
  );
}

export async function resizeForUpload(file: File): Promise<ResizedImage | null> {
  let fuente: ImageBitmap | HTMLImageElement;
  try {
    fuente = await decodificar(file);
  } catch {
    return null;
  }

  const { w, h } = medidas(fuente);
  if (!w || !h) return null;

  // Nunca se agranda: una foto pequeña se sube como está, solo recomprimida.
  const escala = Math.min(1, MAX_SIDE / Math.max(w, h));
  const width = Math.round(w * escala);
  const height = Math.round(h * escala);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(fuente, 0, 0, width, height);
  if ("close" in fuente) fuente.close();

  // WebP primero: pesa alrededor de un tercio menos que un JPEG de calidad
  // equivalente. Si el navegador no sabe codificarlo, `toBlob` devuelve un PNG
  // enorme en silencio, así que se comprueba el tipo y se repite en JPEG.
  let blob = await aBlob(canvas, "image/webp", 0.82);
  if (!blob || blob.type !== "image/webp") {
    blob = await aBlob(canvas, "image/jpeg", 0.85);
  }
  if (!blob) return null;

  return { blob, width, height };
}
