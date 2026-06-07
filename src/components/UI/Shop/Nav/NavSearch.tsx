import { FC, ReactNode, ComponentPropsWithRef } from 'react';
import { Input } from '../../primitives/input';
import { Button } from '../../primitives/button';
import { Search } from 'lucide-react';

// Main NavSearch Component
const NavSearch: FC = () => {
  // Main JSX
  return (
    <>
      <section className='relative flex w-full max-w-[500px]'>
        <Input
          type='text'
          placeholder='Search for products here...'
          className={`relative !bg-transparent rounded-2xl p-1 h-8 pr-8 pl-4 placeholder:text-white/80
              hidden lg:inline-block `}
        />
        <SearchButtonOnly
          name='Search button'
          searchContext='desktop'
          className='hidden lg:!block'
        />
      </section>
    </>
  );
};

interface SearchButtonInterface extends ComponentPropsWithRef<typeof Button> {
  searchContext?: 'desktop' | 'mobile';
  children?: ReactNode;
}

export const SearchButtonOnly: FC<SearchButtonInterface> = ({
  searchContext = 'mobile',
  children,
  className,
  ...props
}) => {
  // Hooks
  return (
    <Button
      variant='link'
      className={`bg-transparent border-none absolute h-8 right-0 p-0 pr-2 flex
            ${className}`}
      onClick={() => {
        if (searchContext === 'desktop') {
          alert('From PC');
        } else {
          alert('From mobile');
        }
      }}
      {...props}
    >
      <Search color='white' size={20} />
      {children}
    </Button>
  );
};

export default NavSearch;
