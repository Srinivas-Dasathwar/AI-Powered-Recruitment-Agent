
import json
import logging
import os
import socket
import urllib.error
import urllib.request

from functools import lru_cache
from pathlib import Path
from urllib.parse import urlsplit

from dotenv import load_dotenv

from openai import (
    OpenAI,
    OpenAIError,
    APIConnectionError,
    APITimeoutError,
    RateLimitError,
)


logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parents[3]
load_dotenv(PROJECT_ROOT / ".env")


# ==================================================
# CONFIGURATION
# ==================================================

def read_integer_setting(name, default, minimum, maximum):
    """Read and validate an integer environment setting."""

    value = os.getenv(name, str(default)).strip()

    try:
        result = int(value)
    except (TypeError, ValueError):
        raise RuntimeError(
            f"Invalid configuration for {name}."
        )

    if not minimum <= result <= maximum:
        raise RuntimeError(
            f"{name} must be between {minimum} and {maximum}."
        )

    return result


AI_PROVIDER = os.getenv(
    "AI_PROVIDER", "openai"
).strip().lower()

OPENAI_API_KEY = os.getenv(
    "OPENAI_API_KEY", ""
).strip()

OPENAI_MODEL = os.getenv(
    "OPENAI_MODEL", "gpt-5.5"
).strip()

OPENAI_TIMEOUT_SECONDS = read_integer_setting(
    "OPENAI_TIMEOUT_SECONDS", 90, 1, 300
)

AI_FALLBACK_TO_OLLAMA = (
    os.getenv(
        "AI_FALLBACK_TO_OLLAMA", "false"
    ).strip().lower() == "true"
)

OLLAMA_BASE_URL = os.getenv(
    "OLLAMA_BASE_URL",
    "http://localhost:11434"
).strip().rstrip("/")

OLLAMA_MODEL = os.getenv(
    "OLLAMA_MODEL", "qwen2.5:1.5b"
).strip()

OLLAMA_TIMEOUT_SECONDS = read_integer_setting(
    "OLLAMA_TIMEOUT_SECONDS", 180, 1, 600
)


# ==================================================
# REQUEST LIMITS
# ==================================================

MAX_SYSTEM_PROMPT_LENGTH = 20000
MAX_USER_PROMPT_LENGTH = 80000
MAX_OUTPUT_TOKENS = 4096

MAX_OLLAMA_RESPONSE_BYTES = 2 * 1024 * 1024


# ==================================================
# CONFIGURATION VALIDATION
# ==================================================

def validate_configuration():
    """Validate provider configuration without exposing secrets."""

    if AI_PROVIDER not in ("openai", "ollama"):
        raise RuntimeError(
            "Invalid AI_PROVIDER configuration."
        )

    if AI_PROVIDER == "openai":
        if not OPENAI_MODEL:
            raise RuntimeError(
                "OPENAI_MODEL is not configured."
            )

        if not OPENAI_API_KEY:
            logger.warning(
                "OpenAI provider selected, but API key is not configured."
            )

    if AI_PROVIDER == "ollama" or AI_FALLBACK_TO_OLLAMA:
        if not OLLAMA_MODEL:
            raise RuntimeError(
                "OLLAMA_MODEL is not configured."
            )

        parsed_url = urlsplit(OLLAMA_BASE_URL)

        if (
            parsed_url.scheme not in ("http", "https")
            or not parsed_url.hostname
            or parsed_url.username
            or parsed_url.password
            or parsed_url.query
            or parsed_url.fragment
        ):
            raise RuntimeError(
                "Invalid OLLAMA_BASE_URL configuration."
            )


validate_configuration()


# ==================================================
# OPENAI CLIENT
# ==================================================

@lru_cache(maxsize=1)
def get_openai_client():
    """Create and reuse the OpenAI client."""

    if not OPENAI_API_KEY:
        raise RuntimeError(
            "OpenAI provider is not configured."
        )

    return OpenAI(
        api_key=OPENAI_API_KEY,
        timeout=OPENAI_TIMEOUT_SECONDS,
        max_retries=2
    )


# ==================================================
# OPENAI RESPONSE GENERATION
# ==================================================

def generate_with_openai(
    system_prompt: str,
    user_prompt: str,
    max_output_tokens: int
) -> str:

    client = get_openai_client()

    response = client.responses.create(
        model=OPENAI_MODEL,
        instructions=system_prompt,
        input=user_prompt,
        max_output_tokens=max_output_tokens
    )

    answer = response.output_text

    if not isinstance(answer, str) or not answer.strip():
        raise RuntimeError(
            "AI provider returned an empty response."
        )

    return answer.strip()


# ==================================================
# OLLAMA CONFIGURATION
# ==================================================

def generate_with_ollama(
    system_prompt: str,
    user_prompt: str,
    max_output_tokens: int
) -> str:

    payload = {
        "model": OLLAMA_MODEL,
        "messages": [
            {
                "role": "system",
                "content": system_prompt
            },
            {
                "role": "user",
                "content": user_prompt
            }
        ],
        "stream": False,
        "keep_alive": "5m",
        "options": {
            "temperature": 0.3,
            "num_ctx": 4096,
            "num_predict": max_output_tokens
        }
    }

    endpoint = f"{OLLAMA_BASE_URL}/api/chat"

    request = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(
            request,
            timeout=OLLAMA_TIMEOUT_SECONDS
        ) as response:

            response_data = response.read(
                MAX_OLLAMA_RESPONSE_BYTES + 1
            )

        if len(response_data) > MAX_OLLAMA_RESPONSE_BYTES:
            raise RuntimeError(
                "Ollama response exceeded the permitted size."
            )

        result = json.loads(
            response_data.decode("utf-8")
        )

        if not isinstance(result, dict):
            raise RuntimeError(
                "Invalid Ollama response format."
            )

        message = result.get("message")

        if not isinstance(message, dict):
            raise RuntimeError(
                "Invalid Ollama message format."
            )

        answer = message.get("content")

        if not isinstance(answer, str) or not answer.strip():
            raise RuntimeError(
                "Ollama returned an empty response."
            )

        return answer.strip()

    except urllib.error.HTTPError as error:
        logger.warning(
            "Ollama returned HTTP status %s.",
            error.code
        )

        raise RuntimeError(
            "Ollama service returned an error."
        ) from error

    except (
        urllib.error.URLError,
        TimeoutError,
        socket.timeout,
        OSError
    ) as error:
        logger.warning(
            "Ollama connection or timeout failure: %s",
            type(error).__name__
        )

        raise RuntimeError(
            "Ollama service is unavailable."
        ) from error

    except (
        json.JSONDecodeError,
        UnicodeDecodeError
    ) as error:
        logger.exception(
            "Ollama returned invalid JSON or encoding."
        )

        raise RuntimeError(
            "Ollama returned an invalid response."
        ) from error


# ==================================================
# FALLBACK POLICY
# ==================================================

def should_use_ollama_fallback(error):
    """
    Use Ollama only for temporary OpenAI availability failures.

    Do not fall back for authentication, permission,
    invalid request, or configuration errors.
    """

    if isinstance(
        error,
        (
            APIConnectionError,
            APITimeoutError,
            RateLimitError
        )
    ):
        return True

    status_code = getattr(error, "status_code", None)

    if status_code in (408, 409):
        return True

    if isinstance(status_code, int) and status_code >= 500:
        return True

    return False


# ==================================================
# SHARED AI RESPONSE FUNCTION
# ==================================================

def generate_ai_response(
    system_prompt: str,
    user_prompt: str,
    max_output_tokens: int = 800
) -> str:

    if not isinstance(system_prompt, str) or not system_prompt.strip():
        raise ValueError(
            "System prompt cannot be empty."
        )

    if not isinstance(user_prompt, str) or not user_prompt.strip():
        raise ValueError(
            "User prompt cannot be empty."
        )

    if len(system_prompt) > MAX_SYSTEM_PROMPT_LENGTH:
        raise ValueError(
            "System prompt exceeds the permitted size."
        )

    if len(user_prompt) > MAX_USER_PROMPT_LENGTH:
        raise ValueError(
            "User prompt exceeds the permitted size."
        )

    if (
        not isinstance(max_output_tokens, int)
        or isinstance(max_output_tokens, bool)
        or not 1 <= max_output_tokens <= MAX_OUTPUT_TOKENS
    ):
        raise ValueError(
            "Invalid AI output token limit."
        )

    # --------------------------------------------------
    # OPENAI PROVIDER
    # --------------------------------------------------

    if AI_PROVIDER == "openai":

        try:
            return generate_with_openai(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                max_output_tokens=max_output_tokens
            )

        except OpenAIError as error:

            logger.warning(
                "OpenAI request failed: %s",
                type(error).__name__
            )

            if not (
                AI_FALLBACK_TO_OLLAMA
                and should_use_ollama_fallback(error)
            ):
                raise RuntimeError(
                    "AI service is temporarily unavailable."
                ) from error

            logger.info(
                "Attempting configured Ollama fallback."
            )

            try:
                return generate_with_ollama(
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    max_output_tokens=max_output_tokens
                )

            except Exception as fallback_error:
                logger.exception(
                    "Ollama fallback failed."
                )

                raise RuntimeError(
                    "AI service is temporarily unavailable."
                ) from fallback_error

        except Exception as error:
            logger.exception(
                "Unexpected OpenAI provider failure."
            )

            raise RuntimeError(
                "AI service is temporarily unavailable."
            ) from error

    # --------------------------------------------------
    # OLLAMA PROVIDER
    # --------------------------------------------------

    if AI_PROVIDER == "ollama":

        try:
            return generate_with_ollama(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                max_output_tokens=max_output_tokens
            )

        except Exception as error:
            logger.exception(
                "Ollama provider request failed."
            )

            raise RuntimeError(
                "AI service is temporarily unavailable."
            ) from error

    raise RuntimeError(
        "AI provider configuration is invalid."
    )
