// Client-side file readers for Brand Memory ingestion.

export function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

export function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsText(file)
  })
}

export function isImage(file: File): boolean {
  return file.type.startsWith('image/')
}

export function isText(file: File): boolean {
  return (
    file.type.startsWith('text/') ||
    /\.(txt|md|markdown|html?|csv|json)$/i.test(file.name)
  )
}
