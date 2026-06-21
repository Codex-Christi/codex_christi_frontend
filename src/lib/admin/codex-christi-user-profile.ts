import 'server-only';

import { getServerDjangoApiBaseUrl } from '@/lib/django/getServerDjangoApiBaseUrl';

export type CodexChristiUserProfilePreview = {
  id: string;
  displayName: string;
  username: string | null;
  profilePic: string | null;
  location: string | null;
};

type PublicUserProfileResponse = {
  data?: {
    id?: string;
    first_name?: string | null;
    last_name?: string | null;
    profile_pic?: string | null;
    username?: string | null;
    state?: string | null;
    country?: string | null;
  };
};

export async function fetchCodexChristiUserProfilePreview({
  accessToken,
  userId,
}: {
  accessToken?: string | null;
  userId: string;
}): Promise<CodexChristiUserProfilePreview | null> {
  const normalizedUserId = userId.trim();

  if (!isUuid(normalizedUserId)) {
    throw new Error('Enter a valid Codex Christi user UUID.');
  }

  const response = await fetch(
    `${getServerDjangoApiBaseUrl()}/account/${encodeURIComponent(normalizedUserId)}/profile`,
    {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    },
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error('Unable to verify that Codex Christi user ID right now.');
  }

  const payload = (await response.json()) as PublicUserProfileResponse;
  const data = payload.data;

  if (!data?.id || data.id !== normalizedUserId) {
    throw new Error('Codex Christi profile verification returned an unexpected user ID.');
  }

  return {
    id: data.id,
    displayName: getProfileDisplayName(data),
    username: normalizeText(data.username),
    profilePic: normalizeText(data.profile_pic),
    location: [normalizeText(data.state), normalizeText(data.country)].filter(Boolean).join(', ') || null,
  };
}

export async function requireCodexChristiUserProfilePreview({
  accessToken,
  userId,
}: {
  accessToken?: string | null;
  userId: string;
}) {
  const profile = await fetchCodexChristiUserProfilePreview({ accessToken, userId });

  if (!profile) {
    throw new Error('No Codex Christi user exists for that user ID.');
  }

  return profile;
}

function getProfileDisplayName(data: NonNullable<PublicUserProfileResponse['data']>) {
  const fullName = [normalizeText(data.first_name), normalizeText(data.last_name)]
    .filter(Boolean)
    .join(' ');

  return fullName || normalizeText(data.username) || data.id || 'Codex Christi user';
}

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim();

  return trimmed || null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
