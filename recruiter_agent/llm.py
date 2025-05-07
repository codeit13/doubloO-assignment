from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langchain_groq import ChatGroq
from config import settings


def create_llm():
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.5,
                     api_key=settings.OPENAI_API_KEY)
    # llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0.5)
    return llm


def create_prompt_template(template_str: str) -> ChatPromptTemplate:
    """
    Creates a ChatPromptTemplate from a template string.

    Args:
        template_str (str): The template string.

    Returns:
        ChatPromptTemplate: A configured ChatPromptTemplate.
    """
    return ChatPromptTemplate.from_template(template_str)
