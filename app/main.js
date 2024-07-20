const net = require("net");
const fs = require("fs").promises;
const path = require("path");
const zlib = require("zlib");

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
    let request = Buffer.alloc(0);

    socket.on("data", (data) => {
      request = Buffer.concat([request, data]);
      if (this.isCompleteRequest(request)) {
        this.processRequest(socket, request);
        request = Buffer.alloc(0);
      }
    });

    socket.on("close", () => {
      console.log("Connection closed.");
    });

    socket.on("error", (error) => {
      console.error("Socket error:", error);
    });
  }

  isCompleteRequest(buffer) {
    const str = buffer.toString();
    if (!str.includes("\r\n\r\n")) return false;

    const [headers, body] = str.split("\r\n\r\n");
    const contentLengthMatch = headers.match(/Content-Length: (\d+)/);
    if (!contentLengthMatch) return true;

    const contentLength = parseInt(contentLengthMatch[1]);
    return body.length >= contentLength;
  }

  async processRequest(socket, requestBuffer) {
    const { method, path, headers, body } = this.parseRequest(requestBuffer);
    try {
      const response = await this.createResponse(method, path, headers, body);
      this.sendResponse(socket, response);
    } catch (error) {
      console.error("Error processing request:", error);
      this.sendResponse(socket, "HTTP/1.1 500 Internal Server Error\r\n\r\n");
    }
  }

  parseRequest(requestBuffer) {
    const request = requestBuffer.toString();
    const [requestLine, ...rest] = request.split("\r\n");
    const [method, path] = requestLine.split(" ");

    const headers = {};
    let bodyStart = rest.indexOf("");
    for (let i = 0; i < bodyStart; i++) {
      const [key, value] = rest[i].split(": ");
      headers[key.toLowerCase()] = value;
    }

    const body = rest.slice(bodyStart + 1).join("\r\n");

    console.log(`Received ${method} request for path: ${path}`);
    console.log(`Received User-Agent: ${headers["user-agent"] || ""}`);
    console.log(
      `Received Accept-Encoding: ${headers["accept-encoding"] || ""}`
    );

    return { method, path, headers, body };
  }

  async createResponse(method, path, headers, body) {
    let responseBody = "";
    let responseHeaders = "";
    let statusCode = 200;

    if (method === "GET") {
      if (path === "/") {
        responseBody = "";
      } else if (path.startsWith("/echo/")) {
        responseBody = path.substring("/echo/".length);
        responseHeaders += "Content-Type: text/plain\r\n";
      } else if (path === "/user-agent") {
        responseBody = headers["user-agent"] || "";
        responseHeaders += "Content-Type: text/plain\r\n";
      } else if (path.startsWith("/files/")) {
        const fileResponse = await this.handleFileRequest(path);
        return fileResponse; // File responses are handled separately
      } else {
        statusCode = 404;
        responseBody = "Not Found";
      }
    } else if (method === "POST" && path.startsWith("/files/")) {
      const fileUploadResponse = await this.handleFileUpload(path, body);
      return fileUploadResponse; // File upload responses are handled separately
    } else {
      statusCode = 404;
      responseBody = "Not Found";
    }

    // Check if the client accepts gzip encoding
    const acceptEncoding = headers["accept-encoding"] || "";
    const acceptedEncodings = acceptEncoding
      .split(",")
      .map((encoding) => encoding.trim().toLowerCase());
    const useGzip = acceptedEncodings.includes("gzip");

    if (useGzip) {
      responseBody = zlib.gzipSync(responseBody);
      responseHeaders += "Content-Encoding: gzip\r\n";
    }

    const contentLength = Buffer.byteLength(responseBody);
    responseHeaders += `Content-Length: ${contentLength}\r\n`;

    return `HTTP/1.1 ${statusCode} ${this.getStatusText(
      statusCode
    )}\r\n${responseHeaders}\r\n${responseBody}`;
  }

  getStatusText(statusCode) {
    const statusTexts = {
      200: "OK",
      201: "Created",
      404: "Not Found",
      500: "Internal Server Error",
    };
    return statusTexts[statusCode] || "";
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

  async handleFileUpload(requestPath, body) {
    const filename = requestPath.substring("/files/".length);
    const filePath = path.join(this.directory, filename);

    try {
      await fs.writeFile(filePath, body);
      return "HTTP/1.1 201 Created\r\n\r\n";
    } catch (error) {
      console.error("Error writing file:", error);
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
