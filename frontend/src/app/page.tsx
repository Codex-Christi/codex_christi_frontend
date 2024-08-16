import HomePageComponent from '@/components/UI/Home';
import BluePlanet from '@/components/UI/Home/BluePlanet';

export default function Home() {
  return (
    <>
      <BluePlanet />

      <main className='w-full max-w-full'>
        <HomePageComponent />
      </main>
    </>
  );
}
