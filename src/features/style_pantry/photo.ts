import { keepLocalCopy } from '@react-native-documents/picker';

// On iOS the picker can return asset-library URIs (ph://) that a later multipart
// upload can't read from directly — copy a local cache copy first.
export async function resolveLocalUri(uri: string, fileName: string): Promise<string> {
  if (!uri.startsWith('ph://') && !uri.startsWith('assets-library://')) {
    return uri;
  }
  try {
    const copies = await keepLocalCopy({
      files: [{ uri, fileName }],
      destination: 'cachesDirectory',
    });
    if (copies && copies[0] && copies[0].status === 'success') {
      return copies[0].localUri;
    }
  } catch {
    // fall back to the original uri and let the upload surface any error
  }
  return uri;
}
