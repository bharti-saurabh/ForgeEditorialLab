import { useState } from 'react'
import { Modal } from '@/components/Modal'
import { Tabs } from '@/components/Tabs'
import { Field, TextInput, TextArea, Select } from '@/components/Field'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { IconUpload, IconDoc, IconImage } from '@/components/icons'
import type { AssetType, BrandAsset, Channel } from '@/types'
import { uid } from '@/lib/format'
import { readAsDataUrl, readAsText, isImage, isText } from '@/lib/file'
import { useAppStore } from '@/store/useAppStore'

const TYPES: AssetType[] = [
  'blog',
  'email',
  'paid-social',
  'display-ad',
  'tagline',
  'landing-page',
  'other',
]
const CHANNELS: Channel[] = ['web', 'email', 'social', 'display', 'search', 'print', 'other']

type Mode = 'upload' | 'paste' | 'url'

export function AddAssetModal({
  open,
  onClose,
  onAdded,
}: {
  open: boolean
  onClose: () => void
  onAdded: (asset: BrandAsset, analyzeNow: boolean) => void
}) {
  const pushToast = useAppStore((s) => s.pushToast)
  const [mode, setMode] = useState<Mode>('paste')
  const [name, setName] = useState('')
  const [type, setType] = useState<AssetType>('blog')
  const [channel, setChannel] = useState<Channel>('web')
  const [date, setDate] = useState('')
  const [campaign, setCampaign] = useState('')
  const [rawCopy, setRawCopy] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [imageUrl, setImageUrl] = useState<string | undefined>()
  const [fileName, setFileName] = useState<string | undefined>()
  const [analyzeNow, setAnalyzeNow] = useState(true)

  function reset() {
    setMode('paste')
    setName('')
    setType('blog')
    setChannel('web')
    setDate('')
    setCampaign('')
    setRawCopy('')
    setSourceUrl('')
    setImageUrl(undefined)
    setFileName(undefined)
    setAnalyzeNow(true)
  }

  async function handleFile(file: File) {
    setFileName(file.name)
    if (!name) setName(file.name.replace(/\.[^.]+$/, ''))
    if (isImage(file)) {
      const url = await readAsDataUrl(file)
      setImageUrl(url)
      setType((t) => (t === 'blog' ? 'display-ad' : t))
      setChannel((c) => (c === 'web' ? 'display' : c))
    } else if (isText(file)) {
      const text = await readAsText(file)
      setRawCopy(text.slice(0, 20000))
    } else {
      // PDFs / binaries: keep a reference, prompt for pasted copy.
      pushToast(
        'info',
        'Non-text file stored as a reference. Paste its copy below for full analysis (in-browser PDF text extraction is not enabled).',
      )
    }
  }

  function canSave(): boolean {
    if (!name.trim()) return false
    if (mode === 'paste') return rawCopy.trim().length > 0
    if (mode === 'url') return sourceUrl.trim().length > 0
    if (mode === 'upload') return Boolean(imageUrl || rawCopy.trim() || fileName)
    return false
  }

  function save() {
    const asset: BrandAsset = {
      id: uid('asset'),
      name: name.trim(),
      type,
      channel,
      rawCopy: rawCopy.trim(),
      imageUrl,
      sourceUrl: sourceUrl.trim() || undefined,
      date: date.trim() || undefined,
      campaign: campaign.trim() || undefined,
      addedAt: Date.now(),
    }
    onAdded(asset, analyzeNow)
    reset()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title="Add brand asset"
      subtitle="Populate the repository so the engine can learn the brand. Upload, paste copy, or paste a URL."
      size="lg"
      footer={
        <>
          <label className="mr-auto flex items-center gap-2 text-sm text-ink-600">
            <input
              type="checkbox"
              checked={analyzeNow}
              onChange={(e) => setAnalyzeNow(e.target.checked)}
              className="h-4 w-4 accent-brand-navy"
            />
            Analyze immediately
          </label>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={!canSave()}>
            Add to repository
          </Button>
        </>
      }
    >
      <Tabs
        tabs={[
          { id: 'paste', label: 'Paste copy' },
          { id: 'upload', label: 'Upload file' },
          { id: 'url', label: 'Paste URL' },
        ]}
        active={mode}
        onChange={(m) => setMode(m as Mode)}
        className="mb-4"
      />

      {mode === 'paste' && (
        <Field label="Asset copy" hint="Paste blog, email, ad, tagline, or landing-page copy.">
          <TextArea
            value={rawCopy}
            onChange={(e) => setRawCopy(e.target.value)}
            placeholder="Paste the marketing copy here…"
            className="min-h-[160px]"
          />
        </Field>
      )}

      {mode === 'upload' && (
        <div>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-ink-200 bg-ink-50/50 px-6 py-8 text-center hover:border-brand-navy/40 hover:bg-ink-50">
            <IconUpload size={26} className="mb-2 text-ink-400" />
            <span className="text-sm font-medium text-ink-700">
              Click to upload an image or text file
            </span>
            <span className="mt-1 text-xs text-ink-400">
              PNG, JPG (creative) or TXT, MD, HTML (copy)
            </span>
            <input
              type="file"
              className="hidden"
              accept="image/*,.txt,.md,.markdown,.html,.htm,.csv,.json,.pdf"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
              }}
            />
          </label>
          {fileName && (
            <div className="mt-3 flex items-center gap-2 text-sm text-ink-600">
              {imageUrl ? <IconImage size={16} /> : <IconDoc size={16} />}
              <span className="font-medium">{fileName}</span>
              {imageUrl && <Badge tone="ok">image loaded</Badge>}
              {!imageUrl && rawCopy && <Badge tone="ok">text loaded</Badge>}
            </div>
          )}
          {imageUrl && (
            <img
              src={imageUrl}
              alt="preview"
              className="mt-3 max-h-48 rounded-lg border border-ink-200"
            />
          )}
          <Field label="Copy (optional, improves analysis)" className="mt-3">
            <TextArea
              value={rawCopy}
              onChange={(e) => setRawCopy(e.target.value)}
              placeholder="Paste the copy shown in the asset…"
            />
          </Field>
        </div>
      )}

      {mode === 'url' && (
        <div className="space-y-3">
          <Field label="Source URL" hint="A landing page, blog post, or ad URL.">
            <TextInput
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://example.com/landing"
              spellCheck={false}
            />
          </Field>
          <Field
            label="Copy from the page (recommended)"
            hint="Browsers can't fetch arbitrary pages directly (CORS). Paste the visible copy so the engine can analyze it."
          >
            <TextArea
              value={rawCopy}
              onChange={(e) => setRawCopy(e.target.value)}
              placeholder="Paste the page copy here…"
            />
          </Field>
        </div>
      )}

      {/* shared metadata */}
      <div className="mt-5 grid gap-3 border-t border-ink-200 pt-4 sm:grid-cols-2">
        <Field label="Asset name">
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Venture rewards email"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={type} onChange={(e) => setType(e.target.value as AssetType)}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Channel">
            <Select value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
              {CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Date (optional)">
          <TextInput
            value={date}
            onChange={(e) => setDate(e.target.value)}
            placeholder="2026-06"
          />
        </Field>
        <Field label="Campaign (optional)">
          <TextInput
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
            placeholder="e.g. Quicksilver Always-On"
          />
        </Field>
      </div>
    </Modal>
  )
}
