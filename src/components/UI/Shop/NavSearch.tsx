import { FC } from 'react';
import { Input } from '../primitives/input';
import { Button } from '../primitives/button';
import { Search } from 'lucide-react';

const NavSearch: FC = () => {
  return (
    <section className='relative flex'>
      <Input type='text' className='relative !bg-transparent rounded-2xl' />
      <Button
        variant='outline'
        size='icon'
        className='bg-transparent border-none absolute'
      >
        <Search color='white' />
      </Button>
    </section>
  );
};

export default NavSearch;
