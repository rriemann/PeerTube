import { ffprobe, FfprobeData } from 'fluent-ffmpeg'
import { VideoFileMetadata } from '@shared/models/videos'

/**
 *
 * Helpers to run ffprobe and extract data from the JSON output
 *
 */

function ffprobePromise (path: string) {
  return new Promise<FfprobeData>((res, rej) => {
    ffprobe(path, (err, data) => {
      if (err) return rej(err)

      return res(data)
    })
  })
}

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------

async function isAudioFile (path: string, existingProbe?: FfprobeData) {
  const videoStream = await getVideoStream(path, existingProbe)

  return !videoStream
}

async function hasAudioStream (path: string, existingProbe?: FfprobeData) {
  const { audioStream } = await getAudioStream(path, existingProbe)

  return !!audioStream
}

async function getAudioStream (videoPath: string, existingProbe?: FfprobeData) {
  // without position, ffprobe considers the last input only
  // we make it consider the first input only
  // if you pass a file path to pos, then ffprobe acts on that file directly
  const data = existingProbe || await ffprobePromise(videoPath)

  if (Array.isArray(data.streams)) {
    const audioStream = data.streams.find(stream => stream['codec_type'] === 'audio')

    if (audioStream) {
      return {
        absolutePath: data.format.filename,
        audioStream,
        bitrate: parseInt(audioStream['bit_rate'] + '', 10)
      }
    }
  }

  return { absolutePath: data.format.filename }
}

function getMaxAudioBitrate (type: 'aac' | 'mp3' | string, bitrate: number) {
  const maxKBitrate = 384
  const kToBits = (kbits: number) => kbits * 1000

  // If we did not manage to get the bitrate, use an average value
  if (!bitrate) return 256

  if (type === 'aac') {
    switch (true) {
      case bitrate > kToBits(maxKBitrate):
        return maxKBitrate

      default:
        return -1 // we interpret it as a signal to copy the audio stream as is
    }
  }

  /*
    a 192kbit/sec mp3 doesn't hold as much information as a 192kbit/sec aac.
    That's why, when using aac, we can go to lower kbit/sec. The equivalences
    made here are not made to be accurate, especially with good mp3 encoders.
    */
  switch (true) {
    case bitrate <= kToBits(192):
      return 128

    case bitrate <= kToBits(384):
      return 256

    default:
      return maxKBitrate
  }
}

// ---------------------------------------------------------------------------
// Video
// ---------------------------------------------------------------------------

async function getVideoStreamDimensionsInfo (path: string, existingProbe?: FfprobeData) {
  const videoStream = await getVideoStream(path, existingProbe)
  if (!videoStream) return undefined

  return {
    width: videoStream.width,
    height: videoStream.height,
    ratio: Math.max(videoStream.height, videoStream.width) / Math.min(videoStream.height, videoStream.width),
    resolution: Math.min(videoStream.height, videoStream.width),
    isPortraitMode: videoStream.height > videoStream.width
  }
}

async function getVideoStreamFPS (path: string, existingProbe?: FfprobeData) {
  const videoStream = await getVideoStream(path, existingProbe)
  if (!videoStream) return 0

  for (const key of [ 'avg_frame_rate', 'r_frame_rate' ]) {
    const valuesText: string = videoStream[key]
    if (!valuesText) continue

    const [ frames, seconds ] = valuesText.split('/')
    if (!frames || !seconds) continue

    const result = parseInt(frames, 10) / parseInt(seconds, 10)
    if (result > 0) return Math.round(result)
  }

  return 0
}

async function buildFileMetadata (path: string, existingProbe?: FfprobeData) {
  const metadata = existingProbe || await ffprobePromise(path)

  return new VideoFileMetadata(metadata)
}

async function getVideoStreamBitrate (path: string, existingProbe?: FfprobeData): Promise<number> {
  const metadata = await buildFileMetadata(path, existingProbe)

  let bitrate = metadata.format.bit_rate as number
  if (bitrate && !isNaN(bitrate)) return bitrate

  const videoStream = await getVideoStream(path, existingProbe)
  if (!videoStream) return undefined

  bitrate = videoStream?.bit_rate
  if (bitrate && !isNaN(bitrate)) return bitrate

  return undefined
}

async function getVideoStreamDuration (path: string, existingProbe?: FfprobeData) {
  const metadata = await buildFileMetadata(path, existingProbe)

  return Math.round(metadata.format.duration)
}

async function getVideoStream (path: string, existingProbe?: FfprobeData) {
  const metadata = await buildFileMetadata(path, existingProbe)

  return metadata.streams.find(s => s.codec_type === 'video')
}

// ---------------------------------------------------------------------------

export {
  getVideoStreamDimensionsInfo,
  buildFileMetadata,
  getMaxAudioBitrate,
  getVideoStream,
  getVideoStreamDuration,
  getAudioStream,
  getVideoStreamFPS,
  isAudioFile,
  ffprobePromise,
  getVideoStreamBitrate,
  hasAudioStream
}
