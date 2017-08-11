### setup
```
cp  config.json.example config.json
```

### start
```
node server
```

### example
```
curl 'localhost:3000/features/secp256k1/sign/0xd2bcca6d133490275af55e3115ffe6ba196bba55c2c4e2c01ede2ab9766d5c14?apiKey=abcd'

{
  "r": "0xe918471ed79c4e013e9badadd55683e64694e7bfd41c64e28f97670244867834",
  "s": "0x74a0463b36a7ba23d7a71cd370b48e006173bbc2ba4471e7546ddb9194f3972e",
  "v": 27
}
```