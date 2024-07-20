const net = require("net");

console.log("Server starting...");

const server = net.createServer((socket) => {
  let request = "";
  socket.on("data", (data) => {
    request += data.toString();

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
    if (requestLine.includes("/user-agent")) {
      const contentLength = Buffer.byteLength(userAgent, "utf8");

      response = `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: ${contentLength}\r\n\r\n${userAgent}`;
    } else if (requestLine.includes("/echo/")) {
      const echoStr = requestLine.split(" ")[1].substring("/echo/".length);
      const contentLength = Buffer.byteLength(echoStr, "utf8");
      response = `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: ${contentLength}\r\n\r\n${echoStr}`;
    } else if (requestLine.includes("/")) {
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
