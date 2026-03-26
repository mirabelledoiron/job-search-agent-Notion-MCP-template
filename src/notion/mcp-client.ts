/**
 * Notion MCP Client — connects to the official Notion MCP server via stdio.
 *
 * Instead of calling the Notion API directly via @notionhq/client, this module
 * starts the Notion MCP server as a child process and communicates with it
 * through the Model Context Protocol (MCP).
 *
 * MCP tools used:
 *   post-search          — search pages/databases by title
 *   query-data-source    — query a database (filter, sort, paginate)
 *   post-page            — create a page
 *   patch-page           — update a page's properties
 *   patch-block-children — append blocks to a page
 *   create-a-data-source — create a new database
 *   retrieve-a-database  — get database metadata
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

let mcpClient: Client | null = null;

/**
 * Returns a connected MCP client. Spawns the Notion MCP server on first call.
 */
export async function getNotionMCP(): Promise<Client> {
  if (mcpClient) return mcpClient;

  const token = process.env.NOTION_TOKEN;
  if (!token) {
    throw new Error("NOTION_TOKEN is not set. Add it to your .env file.");
  }

  const transport = new StdioClientTransport({
    command: "npx",
    args: ["-y", "@notionhq/notion-mcp-server"],
    env: {
      ...process.env as Record<string, string>,
      OPENAPI_MCP_HEADERS: JSON.stringify({
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
      }),
    },
  });

  mcpClient = new Client(
    { name: "job-search-agent", version: "1.0.0" },
    { capabilities: {} },
  );

  await mcpClient.connect(transport);
  console.log("[MCP] Connected to Notion MCP server.");

  return mcpClient;
}

/**
 * Calls a Notion MCP tool and returns the parsed JSON result.
 */
export async function callTool(name: string, args: Record<string, unknown>): Promise<any> {
  const client = await getNotionMCP();
  const result = await client.callTool({ name, arguments: args });

  if (result.isError) {
    const errorText = result.content?.[0]?.type === "text"
      ? (result.content[0] as { text: string }).text
      : JSON.stringify(result.content);
    throw new Error(`MCP tool "${name}" failed: ${errorText}`);
  }

  const textContent = result.content?.find((c: any) => c.type === "text") as { text: string } | undefined;
  if (!textContent) return {};

  try {
    return JSON.parse(textContent.text);
  } catch {
    return textContent.text;
  }
}

/**
 * Closes the MCP connection. Call this when the agent is done.
 */
export async function closeMCP(): Promise<void> {
  if (mcpClient) {
    await mcpClient.close();
    mcpClient = null;
    console.log("[MCP] Disconnected from Notion MCP server.");
  }
}

// ─── Convenience wrappers ─────────────────────────────────────────────────────

export async function mcpSearch(query: string): Promise<any> {
  return callTool("API-post-search", { query });
}

export async function mcpQueryDatabase(databaseId: string, filter?: any, sorts?: any[], pageSize?: number): Promise<any> {
  const args: Record<string, unknown> = { data_source_id: databaseId };
  if (filter) args.filter = filter;
  if (sorts) args.sorts = sorts;
  if (pageSize) args.page_size = pageSize;
  return callTool("API-query-data-source", args);
}

export async function mcpCreatePage(parent: Record<string, unknown>, properties: Record<string, unknown>, children?: any[]): Promise<any> {
  const args: Record<string, unknown> = { parent, properties };
  if (children) args.children = children;
  return callTool("API-post-page", args);
}

export async function mcpUpdatePage(pageId: string, properties: Record<string, unknown>): Promise<any> {
  return callTool("API-patch-page", { page_id: pageId, properties });
}

export async function mcpAppendBlocks(blockId: string, children: any[]): Promise<any> {
  return callTool("API-patch-block-children", { block_id: blockId, children });
}

export async function mcpCreateDatabase(parent: Record<string, unknown>, title: any[], properties: Record<string, unknown>): Promise<any> {
  return callTool("API-create-a-data-source", { parent, title, properties });
}

export async function mcpRetrieveDatabase(databaseId: string): Promise<any> {
  return callTool("API-retrieve-a-database", { database_id: databaseId });
}
