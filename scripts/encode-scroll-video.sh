#!/usr/bin/env bash
#
# Reencodea un video para el scroll-scrubbing de CleaningScrollVideo.tsx.
#
# Los archivos que entregan las herramientas de generación (Higgsfield y
# similares) vienen con UN SOLO keyframe y el índice al final: los dos
# detalles que hacen que el scrubbing se sienta trabado. Este script aplica
# el tratamiento completo de una vez, así no hay que recordar los flags cada
# vez que llega un video nuevo.
#
#   scripts/encode-scroll-video.sh entrada.mp4 salida.mp4 [fps] [crf]
#
# Qué hace cada cosa, y por qué:
#
#   -g 1 -keyint_min 1 -sc_threshold 0 -bf 0
#       Un keyframe por cuadro. El scrubbing pide un currentTime distinto en
#       cada cuadro de scroll; con keyframes espaciados, cada salto hacia
#       adelante obliga a decodificar toda la cadena intermedia (medido:
#       35-50ms adelante contra 4-8ms atrás — esa asimetría es la huella del
#       problema). Con todos los cuadros como keyframe, cualquier salto
#       cuesta 3-7ms parejo. El costo es tamaño de archivo.
#
#   -movflags +faststart
#       Mueve el índice (moov) al principio. Si queda al final, el navegador
#       tiene que descargar casi todo el archivo antes de poder buscar, y el
#       scrubbing se traba hasta que termina de bajar. No cuesta calidad.
#
#   fps (default 20)
#       El scrubbing mapea scroll → tiempo, así que lo que importa no es que
#       sean 30 cuadros por segundo sino cuántos cuadros distintos hay a lo
#       largo del recorrido. Bajar de 30 a 20 saca un tercio de los bytes sin
#       tocar la nitidez de cada cuadro. La duración no cambia.
#
#   -an
#       El <video> va muted; la pista de audio que generan estas
#       herramientas solo pesa.
#
set -euo pipefail

if [ $# -lt 2 ]; then
  echo "uso: $0 entrada.mp4 salida.mp4 [fps] [crf]" >&2
  exit 1
fi

entrada=$1
salida=$2
fps=${3:-20}
crf=${4:-23}

if [ ! -f "$entrada" ]; then
  echo "no existe: $entrada" >&2
  exit 1
fi

ffmpeg -y -loglevel error -i "$entrada" \
  -an \
  -vf "fps=$fps" \
  -c:v libx264 -preset slow -crf "$crf" \
  -g 1 -keyint_min 1 -sc_threshold 0 -bf 0 \
  -pix_fmt yuv420p \
  -movflags +faststart \
  "$salida"

# Verificación: si algo de esto no da lo esperado, el video va a andar lento
# en el sitio aunque el archivo "se vea bien".
cuadros=$(ffprobe -v error -select_streams v:0 -show_entries stream=nb_frames -of csv=p=0 "$salida")
claves=$(ffprobe -v error -select_streams v:0 -show_entries frame=pict_type -of csv=p=0 "$salida" | grep -c '^I')
duracion=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$salida")
tamano=$(ls -lh "$salida" | awk '{print $5}')
moov=$(head -c 200000 "$salida" | grep -abo moov | head -1 | cut -d: -f1)

echo "$salida"
echo "  tamaño:    $tamano"
echo "  cuadros:   $cuadros ($claves keyframes)"
echo "  duración:  ${duracion}s"
if [ -n "${moov:-}" ]; then
  echo "  faststart: sí (moov en byte $moov)"
else
  echo "  faststart: NO — el índice quedó al final"
fi

if [ "$cuadros" != "$claves" ]; then
  echo "  AVISO: no todos los cuadros son keyframe; el scrubbing va a saltar." >&2
  exit 1
fi
if [ -z "${moov:-}" ]; then
  echo "  AVISO: sin faststart; el navegador va a esperar toda la descarga." >&2
  exit 1
fi
