const net = require("net");

console.log("Server starting...");

const server = net.createServer((socket) => {
  let buffer = "";

  socket.on("data", (data) => {
    buffer += data.toString();

    const requestEndIndex = buffer.indexOf("\r\n\r\n");
    while (requestEndIndex !== -1) {
      const request = buffer.substring(0, requestEndIndex + "\r\n\r\n".length);

      handleRequest(socket, request);

      buffer = buffer.substring(requestEndIndex + "\r\n\r\n".length);

      requestEndIndex = buffer.indexOf("\r\n\r\n");
    }
  });

  socket.on("close", () => {
    console.log("Connection closed.");
  });
});

function handleRequest(socket, request) {
  const lines = request.split("\r\n");
  const requestLine = lines[0];
  const headers = lines.slice(1, lines.length - 2);

  let userAgent = "";
  for (let header of headers) {
    if (header.startsWith("User-Agent: ")) {
      userAgent = header.substring("User-Agent: ".length);
      break;
    }
  }

  console.log(`Received User-Agent: ${userAgent}`);

  let response;
  const path = requestLine.split(" ")[1];

  if (path === "/") {
    response = "HTTP/1.1 200 OK\r\n\r\n";
  } else if (path.startsWith("/echo/")) {
    const echoStr = path.substring("/echo/".length);
    const contentLength = Buffer.byteLength(echoStr, "utf8");
    response = `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: ${contentLength}\r\n\r\n${echoStr}`;
  } else if (path === "/user-agent") {
    const contentLength = Buffer.byteLength(userAgent, "utf8");
    response = `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: ${contentLength}\r\n\r\n${userAgent}`;
  } else {
    response = "HTTP/1.1 404 Not Found\r\n\r\n";
  }

  socket.write(response);
}

server.listen(4221, "localhost", () => {
  console.log("Server listening on port 4221...");
});
