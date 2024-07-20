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
      if (this.isCompleteRequest(request)) {
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

  isCompleteRequest(request) {
    const [headers, body] = request.split("\r\n\r\n");
    if (!headers || !body) return false;

    const contentLengthMatch = headers.match(/Content-Length: (\d+)/);
    if (!contentLengthMatch) return request.includes("\r\n\r\n");

    const contentLength = parseInt(contentLengthMatch[1], 10);
    return body.length >= contentLength;
  }

  async processRequest(socket, request) {
    const { method, path, headers, body } = this.parseRequest(request);
    try {
      const response = await this.createResponse(method, path, headers, body);
      this.sendResponse(socket, response);
    } catch (error) {
      console.error("Error processing request:", error);
      this.sendResponse(socket, "HTTP/1.1 500 Internal Server Error\r\n\r\n");
    }
  }

  parseRequest(request) {
    const [requestLine, ...rest] = request.split("\r\n");
    const [method, path] = requestLine.split(" ");
    const [headersPart, body] = rest.join("\r\n").split("\r\n\r\n");
    const headers = Object.fromEntries(
      headersPart.split("\r\n").map((line) => {
        const [key, value] = line.split(": ");
        return [key.toLowerCase(), value];
      })
    );

    console.log(`Received ${method} request for path: ${path}`);
    return { method, path, headers, body };
  }

  async createResponse(method, path, headers, body) {
    if (method === "GET") {
      if (path === "/") {
        return "HTTP/1.1 200 OK\r\n\r\n";
      } else if (path.startsWith("/echo/")) {
        const echoStr = path.substring("/echo/".length);
        const contentLength = Buffer.byteLength(echoStr, "utf8");
        return `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: ${contentLength}\r\n\r\n${echoStr}`;
      } else if (path === "/user-agent") {
        const userAgent = headers["user-agent"] || "";
        const contentLength = Buffer.byteLength(userAgent, "utf8");
        return `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: ${contentLength}\r\n\r\n${userAgent}`;
      } else if (path.startsWith("/files/")) {
        return await this.handleFileRequest(path);
      }
    } else if (method === "POST" && path.startsWith("/files/")) {
      return await this.handleFileCreation(path, body);
    }

    return "HTTP/1.1 404 Not Found\r\n\r\n";
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

  async handleFileCreation(requestPath, content) {
    const filename = requestPath.substring("/files/".length);
    const filePath = path.join(this.directory, filename);

    try {
      await fs.writeFile(filePath, content);
      return "HTTP/1.1 201 Created\r\n\r\n";
    } catch (error) {
      console.error("Error creating file:", error);
      return "HTTP/1.1 500 Internal Server Error\r\n\r\n";
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
