const getRandomArbitrary = (min, max) => Math.random() * (max - min) + min;

const getRandomInt = (from, to) => {
  const min = Math.ceil(from);
  const max = Math.floor(to);
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

function sleep(ms) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve(true);
      clearTimeout(timeout);
    }, ms);
  });
}

export { sleep, getRandomArbitrary, getRandomInt };
