import axios from 'axios';

export default async function Page() {
  try {
    const resp = await axios.get('https://codexchristi.org/api/user-profile');
    console.log(resp);
  } catch (error) {
    console.error(error);
  }

  //   const profile = await data.json();
  return <h1>{0}</h1>;
}
