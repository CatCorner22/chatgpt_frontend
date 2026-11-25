/** Read the original bytes, including on browsers that only expose FileReader. */
export async function readFileBytes(
  file: File,
  messages: { failed: string; cancelled: string; invalidResult?: string },
): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === "function") return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      reader.result instanceof ArrayBuffer
        ? resolve(reader.result)
        : reject(new Error(messages.invalidResult ?? messages.failed));
    reader.onerror = () => reject(new Error(messages.failed));
    reader.onabort = () => reject(new Error(messages.cancelled));
    reader.readAsArrayBuffer(file);
  });
}
