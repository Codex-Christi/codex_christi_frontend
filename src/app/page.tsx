import HomePageComponent from '@/components/UI/Home';
import BluePlanet from '@/components/UI/Home/BluePlanet';

export default function Home() {
  return (
    <>
      <main className='w-full max-w-full !min-h-[100vh] pb-10 !overflow-x-hidden relative'>
        <BluePlanet />

        <HomePageComponent />
      </main>
    </>
  );
}
