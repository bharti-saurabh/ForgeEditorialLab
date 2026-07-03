// Read-only chip echoing the pipeline's primary channel (chosen in Step 2) so
// the surface a piece is authored for stays visible across Steps 3-5.

import { useAppStore } from '@/store/useAppStore'
import { channelSpec } from '@/lib/channels'
import { IconRoute } from '@/components/icons'
import { cn } from '@/lib/cn'

export function ChannelChip({ className }: { className?: string }) {
  const primaryChannel = useAppStore((s) => s.pipeline.primaryChannel)
  const spec = channelSpec(primaryChannel)
  return (
    <span
      title="Publish channel — set in Step 2 · Brief & Draft"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-straive-200 bg-straive-50/70 px-2.5 py-1 text-xs font-medium text-straive-700',
        className,
      )}
    >
      <IconRoute size={13} className="shrink-0" />
      {spec.label}
    </span>
  )
}
