import axios, { AxiosError, AxiosResponse } from 'axios';
import { cookies } from 'next/headers';

const client = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_BASE_URL}`,
});

export const revalidate = 600;

interface UserData {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

const getUser = async () => {
  const accessToken = (await cookies()).get('accessToken')?.value;

  const apiResponse = await client
    .get('/account/user-profile', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    .then((resp: AxiosResponse<UserData>) => resp.data)
    .catch((err: AxiosError) => err);

  console.log(apiResponse);

  return apiResponse;
};

export default async function Page() {
  const apiResponse = await getUser();

  return (
    // <div
    //   key={id}
    //   className='border border-white max-w-[400px] mx-auto py-5 shadow-sm shadow-slate-200
    //         rounded-lg my-7 w-full text-center'
    // >
    //   <h2>
    //     {first_name ? first_name : 'No name'} {last_name}
    //   </h2>
    //   <h5>Email : {email}</h5>
    // </div>

    <h3>Hello</h3>
  );
}
