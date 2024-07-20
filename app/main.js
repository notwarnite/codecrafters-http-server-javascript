const net = require("net");
const fs = require("fs").promises;
const path = require("path");

class HTTPServer {
  constructor(port, directory) {
    this.port = port;
    this.directory = directory;
    this.server = net.createServer(this.handleConnection.bind(this));
  }

  start() {
    this.server.listen(this.port, "localhost", () => {
      console.log(`Server listening on port ${this.port}...`);
    });
  }

  handleConnection(socket) {
    console.log("New connection established.");
    let request = "";

    socket.on("data", (data) => {
      request += data.toString();
      if (request.includes("\r\n\r\n")) {
        this.processRequest(socket, request);
        request = "";
      }
    });

    socket.on("close", () => {
      console.log("Connection closed.");
    });

    socket.on("error", (error) => {
      console.error("Socket error:", error);
    });
  }

  async processRequest(socket, request) {
    const { path, userAgent } = this.parseRequest(request);
    const response = this.createResponse(path, userAgent);
    this.sendResponse(socket, response);
  }

  parseRequest(request) {
    const lines = request.split("\r\n");
    const requestLine = lines[0];
    const headers = lines.slice(1, -2);

    const path = requestLine.split(" ")[1];
    const userAgent =
      headers
        .find((header) => header.startsWith("User-Agent: "))
        ?.substring("User-Agent: ".length) || "";

    console.log(`Received request for path: ${path}`);
    console.log(`Received User-Agent: ${userAgent}`);

    return { path, userAgent };
  }

  async createResponse(path, userAgent) {
    if (path === "/") {
      return "HTTP/1.1 200 OK\r\n\r\n";
    } else if (path.startsWith("/echo/")) {
      const echoStr = path.substring("/echo/".length);
      const contentLength = Buffer.byteLength(echoStr, "utf8");
      return `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: ${contentLength}\r\n\r\n${echoStr}`;
    } else if (path === "/user-agent") {
      const contentLength = Buffer.byteLength(userAgent, "utf8");
      return `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: ${contentLength}\r\n\r\n${userAgent}`;
    } else if (requestPath.startsWith("/files/")) {
      return await this.handleFileRequest(requestPath);
    } else {
      return "HTTP/1.1 404 Not Found\r\n\r\n";
    }
  }

  async handleFileRequest(requestPath) {
    const filename = requestPath.substring("/files/".length);
    const filePath = path.join(this.directory, filename);

    try {
      const fileContent = await fs.readFile(filePath);
      const contentLength = fileContent.length;
      return `HTTP/1.1 200 OK\r\nContent-Type: application/octet-stream\r\nContent-Length: ${contentLength}\r\n\r\n${fileContent}`;
    } catch (error) {
      if (error.code === "ENOENT") {
        return "HTTP/1.1 404 Not Found\r\n\r\n";
      } else {
        console.error("Error reading file:", error);
        return "HTTP/1.1 500 Internal Server Error\r\n\r\n";
      }
    }
  }

  sendResponse(socket, response) {
    socket.write(response, () => {
      socket.end();
    });
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const directoryIndex = args.indexOf("--directory");
  if (directoryIndex !== -1 && directoryIndex < args.length - 1) {
    return args[directoryIndex + 1];
  }
  return process.cwd();
}

const directory = parseArgs();
console.log(`Serving files from directory: ${directory}`);
const server = new HTTPServer(4221, directory);
server.start();
