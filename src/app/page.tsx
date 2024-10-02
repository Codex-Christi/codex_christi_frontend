import HomePageComponent from '@/components/UI/Home';
import BluePlanet from '@/components/UI/Home/BluePlanet';
import DefaultPageWrapper from '@/components/UI/general/DefaultPageWrapper';

// Main Page / page-specific component
export default function Home() {
  // Hooks

  // Main JSX
  return (
    <DefaultPageWrapper hasMainNav>
      <main className='w-full max-w-full !min-h-[100vh] pb-10 !overflow-x-hidden relative'>
        <BluePlanet />

        <HomePageComponent />
      </main>
    </DefaultPageWrapper>
  );
}
