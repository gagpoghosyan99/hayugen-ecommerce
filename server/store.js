const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "data", "store.json");

const empty = () => ({
  users: [],
  sessions: [],
  carts: {},
  orders: [],
  messages: [],
  resets: [],
});

function read() {
  try {
    return { ...empty(), ...JSON.parse(fs.readFileSync(file, "utf8")) };
  } catch {
    return empty();
  }
}

function write(data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function update(mutator) {
  const data = read();
  const result = mutator(data);
  write(data);
  return result;
}

module.exports = { read, write, update };
