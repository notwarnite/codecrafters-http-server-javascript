const net = require("net");

console.log("Server starting...");

const server = net.createServer((socket) => {
  let request = "";
  socket.on("data", (data) => {
    request += data.toString();

    const lines = request.split("\r\n");
    const requestLine = lines[0];
    const parts = requestLine.split(" ");
    const method = parts[0];
    const path = parts[1];

    console.log(`Received request: ${method} ${path}`);

    let response;
    if (path.startsWith("/user-agent")) {
      const header = lines[1];
      const userAgent = header.split(":")[1].trim();
      response = `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: ${Buffer.byteLength(
        userAgent,
        "utf8"
      )}\r\n\r\n${userAgent}`;
    } else if (path.startsWith("/echo/")) {
      const echoStr = path.substring("/echo/".length);
      const contentLength = Buffer.byteLength(echoStr, "utf8");

      response = `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: ${contentLength}\r\n\r\n${echoStr}`;
    } else if (path === "/") {
      response = "HTTP/1.1 200 OK\r\n\r\n";
    } else {
      response = "HTTP/1.1 404 Not Found\r\n\r\n";
    }

    socket.write(response);
    socket.end();
  });

  socket.on("close", () => {
    console.log("Connection closed.");
  });
});

server.listen(4221, "localhost", () => {
  console.log("Server listening on port 4221...");
});
