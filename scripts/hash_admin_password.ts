import argon2 from 'argon2';

const password = process.argv[2];

if (!password) {
  console.error('Usage: yarn admin:hash-password "admin password"');
  process.exit(1);
}

const hash = await argon2.hash(password, {
  type: argon2.argon2id,
});

console.log(hash);

