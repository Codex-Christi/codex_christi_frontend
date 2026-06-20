import argon2 from 'argon2';

async function main() {
  const password = process.argv[2];

  if (!password) {
    console.error(
      'Usage: yarn admin:auth:create-unlock-password-hash "admin unlock password"',
    );
    process.exit(1);
  }

  const hash = await argon2.hash(password, {
    type: argon2.argon2id,
  });

  console.log(hash);
}

void main();
