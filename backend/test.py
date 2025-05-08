from langchain_tavily import TavilySearch
import json
from config import settings

search_tool = TavilySearch(
        tavily_api_key=settings.TAVILY_SEARCH_API_KEY,
        max_results=1,
        topic="general",
    )

results  = search_tool.invoke({"query": "SumitChauhan github"})
print(json.dumps(results, indent=2))