type AdminTimestampOptions = {
  includeYear?: boolean;
};

export function formatAdminSystemTimestamp(
  value: Date | null | undefined,
  { includeYear = true }: AdminTimestampOptions = {},
) {
  if (!value) return null;

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' as const } : {}),
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(value);
}
