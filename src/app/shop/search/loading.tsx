export default function SearchLoading() {
  return (
    <main
      aria-busy='true'
      aria-label='Loading search results'
      style={{ minHeight: '65vh', padding: '2rem 1rem' }}
    >
      <p role='status'>Searching products...</p>
    </main>
  );
}
