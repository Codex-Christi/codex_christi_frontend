import SessionUnavailablePage, {
  type SessionUnavailablePageProps,
  sessionUnavailableMetadata,
} from '@/components/UI/Auth/SessionUnavailablePage';

export const metadata = sessionUnavailableMetadata;
export default function Page(props: SessionUnavailablePageProps) {
  return <SessionUnavailablePage {...props} />;
}
