process.send({ ready: true });
setTimeout(() => process.exit(7), 50);
