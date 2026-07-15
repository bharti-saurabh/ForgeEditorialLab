import { useState, type ReactNode } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Card, CardBody, CardHeader } from '@/components/Card'
import { Field, TextInput, Slider } from '@/components/Field'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { SectionTitle } from '@/components/EmptyState'
import {
  IconGear,
  IconEye,
  IconEyeOff,
  IconCheck,
  IconAlert,
  IconRefresh,
  IconTrash,
} from '@/components/icons'
import { testTextConnection, testImageConnection } from '@/lib/router/test'
import type { ModelSlotKey, RoleTestResult } from '@/types'
import { fmtMs } from '@/lib/format'
import { cn } from '@/lib/cn'

export function SettingsView() {
  const settings = useAppStore((s) => s.settings)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const updateModels = useAppStore((s) => s.updateModels)
  const resetSettings = useAppStore((s) => s.resetSettings)
  const clearKey = useAppStore((s) => s.clearKey)
  const resetAllData = useAppStore((s) => s.resetAllData)
  const testResults = useAppStore((s) => s.testResults)
  const setTestResult = useAppStore((s) => s.setTestResult)
  const pushToast = useAppStore((s) => s.pushToast)

  const [showKey, setShowKey] = useState(false)
  const live = Boolean(settings.gatewayUrl.trim() && settings.apiKey.trim())

  function updateBaseUrl(slot: ModelSlotKey, v: string) {
    updateSettings({ baseUrls: { ...settings.baseUrls, [slot]: v } })
  }

  async function runTest(slot: ModelSlotKey) {
    setTestResult(slot, { state: 'testing' })
    const result =
      slot === 'image' ? await testImageConnection() : await testTextConnection()
    setTestResult(slot, result)
    pushToast(
      result.state === 'ok' ? 'success' : 'error',
      result.message ?? (result.state === 'ok' ? 'Connection OK' : 'Connection failed'),
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      <SectionTitle
        title="Settings"
        description="Connect your LLM Foundry gateway and assign a model to each role. Your keys stay in the browser. Prompts go to your configured gateway; Topic Intelligence's discovery also fetches public trends/sources through this app's own server function (a search key, if set, lives server-side, never in the browser)."
        actions={
          <Badge tone={live ? 'ok' : 'warn'} dot>
            {live ? 'Live mode — gateway configured' : 'Demo mode — using seeded responses'}
          </Badge>
        }
      />

      {/* Gateway connection */}
      <Card className="mb-5">
        <CardHeader
          icon={<IconGear size={18} />}
          title="Gateway connection"
          subtitle="OpenAI-compatible endpoint. We POST to {gateway}/chat/completions with a Bearer key."
        />
        <CardBody className="space-y-4">
          <Field
            label="Gateway base URL"
            hint="e.g. https://llmfoundry.straive.com/openai/v1"
          >
            <TextInput
              value={settings.gatewayUrl}
              onChange={(e) => updateSettings({ gatewayUrl: e.target.value })}
              placeholder="https://your-gateway/openai/v1"
              spellCheck={false}
            />
          </Field>

          <Field label="API key" hint="Stored only in your browser.">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <TextInput
                  type={showKey ? 'text' : 'password'}
                  value={settings.apiKey}
                  onChange={(e) => updateSettings({ apiKey: e.target.value })}
                  placeholder="sk-…"
                  spellCheck={false}
                  autoComplete="off"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700"
                  aria-label={showKey ? 'Hide key' : 'Show key'}
                >
                  {showKey ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              </div>
              <Button variant="secondary" onClick={clearKey} disabled={!settings.apiKey}>
                Clear
              </Button>
            </div>
          </Field>

          <label className="flex items-center gap-2.5 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={settings.persistKey}
              onChange={(e) => updateSettings({ persistKey: e.target.checked })}
              className="h-4 w-4 accent-brand-navy"
            />
            Remember the API key in this browser (uncheck to keep it in memory only)
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Image endpoint path" hint="Relative to the gateway base URL.">
              <TextInput
                value={settings.imageEndpoint}
                onChange={(e) => updateSettings({ imageEndpoint: e.target.value })}
                placeholder="/images/generations"
                spellCheck={false}
              />
            </Field>
            <Field
              label={`Default temperature — ${settings.temperature.toFixed(2)}`}
              hint="Lower = more deterministic; higher = more creative."
            >
              <Slider
                label=""
                value={Math.round(settings.temperature * 100)}
                onChange={(v) => updateSettings({ temperature: v / 100 })}
                min={0}
                max={100}
                leftLabel="0.0 precise"
                rightLabel="1.0 creative"
              />
            </Field>
          </div>
        </CardBody>
      </Card>

      {/* Model assignments */}
      <Card className="mb-5">
        <CardHeader
          icon={<IconRefresh size={18} />}
          title="Model assignments — right model for the right job"
          subtitle="Each role routes to the model you name here. All reachable through the one gateway."
        />
        <CardBody className="space-y-4">
          <ModelRow
            title="Text & reasoning model"
            desc="Strategy, briefs, copywriting, compliance analysis, persona simulation."
            badge="Claude class"
            value={settings.models.text}
            onChange={(v) => updateModels({ text: v })}
            placeholder="claude-sonnet-4"
            baseUrl={settings.baseUrls.text}
            onBaseUrlChange={(v) => updateBaseUrl('text', v)}
            baseUrlPlaceholder="Defaults to the gateway base URL above"
            test={testResults.text}
            onTest={() => runTest('text')}
          />
          <ModelRow
            title="Image model"
            desc='On-brand visual generation — Google "Nano Banana" (Gemini image).'
            badge="Gemini image"
            value={settings.models.image}
            onChange={(v) => updateModels({ image: v })}
            placeholder="gemini-2.5-flash-image"
            baseUrl={settings.baseUrls.image}
            onBaseUrlChange={(v) => updateBaseUrl('image', v)}
            baseUrlPlaceholder="https://llmfoundry.straive.com/v1beta"
            test={testResults.image}
            onTest={() => runTest('image')}
          >
            <Field
              label="Image API style"
              hint={
                settings.imageApi === 'gemini'
                  ? 'Gemini: POST {base}/models/{model}:generateContent (no /images route).'
                  : 'OpenAI: POST {base}' + settings.imageEndpoint + ' with a prompt.'
              }
            >
              <select
                value={settings.imageApi}
                onChange={(e) => updateSettings({ imageApi: e.target.value as 'openai' | 'gemini' })}
                className="h-9 w-full rounded-lg border border-ink-200 bg-white px-2 text-sm font-medium text-ink-700 focus:border-straive-400 focus:outline-none focus:ring-2 focus:ring-straive-500/20"
              >
                <option value="gemini">Gemini — generateContent (Nano Banana)</option>
                <option value="openai">OpenAI — /images/generations</option>
              </select>
            </Field>
          </ModelRow>
          <ModelRow
            title="Vision model (optional)"
            desc="Reads uploaded creative. Leave blank to reuse the text/reasoning model."
            badge="Vision"
            value={settings.models.vision}
            onChange={(v) => updateModels({ vision: v })}
            placeholder="(defaults to text model)"
            baseUrl={settings.baseUrls.vision}
            onBaseUrlChange={(v) => updateBaseUrl('vision', v)}
            baseUrlPlaceholder="Defaults to text / gateway base URL"
          />
          <p className="text-xs text-ink-400">
            Extensible by design — add a fast/cheap classifier or a video/voice model later
            without touching the UI.
          </p>
        </CardBody>
      </Card>

      {/* Danger zone */}
      <Card className="border-crit/20">
        <CardHeader
          icon={<IconTrash size={18} />}
          title="Data & reset"
          subtitle="All data lives in this browser. Reset to reload the synthetic seed set."
        />
        <CardBody className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={resetSettings} icon={<IconRefresh size={15} />}>
            Reset settings to defaults
          </Button>
          <Button
            variant="danger"
            icon={<IconTrash size={15} />}
            onClick={() => {
              if (
                confirm(
                  'Reset ALL app data to the synthetic seed set? This clears your repository edits, profile edits, and router log.',
                )
              ) {
                resetAllData()
                pushToast('info', 'All data reset to the seed set.')
              }
            }}
          >
            Reset all data
          </Button>
        </CardBody>
      </Card>
    </div>
  )
}

function ModelRow({
  title,
  desc,
  badge,
  value,
  onChange,
  placeholder,
  baseUrl,
  onBaseUrlChange,
  baseUrlPlaceholder,
  test,
  onTest,
  children,
}: {
  title: string
  desc: string
  badge: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  baseUrl?: string
  onBaseUrlChange?: (v: string) => void
  baseUrlPlaceholder?: string
  test?: RoleTestResult
  onTest?: () => void
  children?: ReactNode
}) {
  return (
    <div className="rounded-lg border border-ink-200 p-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-ink-800">{title}</span>
            <Badge tone="navy">{badge}</Badge>
          </div>
          <p className="mt-0.5 text-xs text-ink-500">{desc}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <TextInput
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          spellCheck={false}
        />
        {onTest && (
          <Button
            variant="secondary"
            onClick={onTest}
            loading={test?.state === 'testing'}
            className="shrink-0"
          >
            Test
          </Button>
        )}
      </div>

      {onBaseUrlChange && (
        <div className="mt-2">
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-400">
            Base URL override
          </label>
          <TextInput
            value={baseUrl ?? ''}
            onChange={(e) => onBaseUrlChange(e.target.value)}
            placeholder={baseUrlPlaceholder}
            spellCheck={false}
          />
        </div>
      )}

      {children && <div className="mt-3">{children}</div>}
      {test && test.state !== 'idle' && test.state !== 'testing' && (
        <div
          className={cn(
            'mt-2 flex items-start gap-1.5 rounded-md px-2.5 py-1.5 text-xs',
            test.state === 'ok' ? 'bg-ok/10 text-ok' : 'bg-crit/10 text-crit',
          )}
        >
          {test.state === 'ok' ? (
            <IconCheck size={14} className="mt-0.5 shrink-0" />
          ) : (
            <IconAlert size={14} className="mt-0.5 shrink-0" />
          )}
          <span>
            {test.message}
            {test.latencyMs !== undefined && test.state === 'ok' && (
              <span className="opacity-70"> · {fmtMs(test.latencyMs)}</span>
            )}
          </span>
        </div>
      )}
    </div>
  )
}
