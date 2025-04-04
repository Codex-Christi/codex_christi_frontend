import axios from 'axios';

const client = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_BASE_URL}`,
});

export default async function Page() {
  try {
    const resp = await client.get('/user-profile');
    console.log(resp.data);
  } catch (error) {
    console.error(error);
  }

  //   const profile = await data.json();
  return <h1>{0}</h1>;
}
