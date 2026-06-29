import { ComponentPropsWithoutRef, FC, ReactNode } from 'react';
import { Input } from '../../primitives/input';
import { Search } from 'lucide-react';

// Main NavSearch Component
const NavSearch: FC = () => {
  // Main JSX
  return (
    <form action='/shop/categories/all' className='contents' role='search'>
      <section className='relative flex w-full max-w-[500px]'>
        <Input
          name='q'
          type='text'
          placeholder='Search for products here...'
          className={`relative !bg-transparent rounded-2xl p-1 h-8 pr-8 pl-4 placeholder:text-white/80
              hidden lg:inline-block `}
        />
        <SearchButtonOnly
          name='Search button'
          className='hidden lg:!block'
        />
      </section>
    </form>
  );
};

interface SearchButtonInterface extends ComponentPropsWithoutRef<'button'> {
  children?: ReactNode;
}

export const SearchButtonOnly: FC<SearchButtonInterface> = ({
  children,
  className,
  'aria-label': ariaLabel,
  name,
  type = 'submit',
  ...props
}) => {
  // Hooks
  return (
    <button
      type={type}
      aria-label={ariaLabel ?? name}
      className={`bg-transparent border-none absolute h-8 right-0 p-0 pr-2 flex
            ${className}`}
      name={name}
      {...props}
    >
      <Search color='white' size={20} />
      {children}
    </button>
  );
};

export default NavSearch;
