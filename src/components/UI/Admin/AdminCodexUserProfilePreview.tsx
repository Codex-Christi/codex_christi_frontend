import { UserRoundCheck } from 'lucide-react';
import type { CodexChristiUserProfilePreview } from '@/lib/admin/codex-christi-user-profile';
import { adminInsetSurfaceClass } from '@/components/UI/Admin/dashboard/AdminGlassPanel';

export default function AdminCodexUserProfilePreview({
  profile,
}: {
  profile: CodexChristiUserProfilePreview;
}) {
  return (
    <div className={`${adminInsetSurfaceClass} flex items-center gap-3 p-3`}>
      {profile.profilePic ? (
        <span
          role='img'
          aria-label={profile.displayName}
          className='h-11 w-11 rounded-lg border border-white/10 object-cover'
          style={{
            backgroundImage: `url(${profile.profilePic})`,
            backgroundPosition: 'center',
            backgroundSize: 'cover',
          }}
        />
      ) : (
        <span className='grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-100'>
          <UserRoundCheck size={20} />
        </span>
      )}
      <div className='min-w-0'>
        <p className='truncate text-sm font-semibold text-white'>{profile.displayName}</p>
        <p className='truncate text-xs text-slate-400'>
          {profile.username ? `@${profile.username}` : profile.id}
        </p>
        {profile.location ? (
          <p className='mt-0.5 truncate text-xs text-slate-500'>{profile.location}</p>
        ) : null}
      </div>
    </div>
  );
}
