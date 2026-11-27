from types import SimpleNamespace

import pytest

from backend.app.services import ai_service


@pytest.fixture
def valid_prompts():
    return {
        "system_prompt": "You are a recruitment assistant.",
        "user_prompt": "Analyze this sample resume.",
    }


def test_rejects_empty_system_prompt(valid_prompts):
    with pytest.raises(ValueError, match="System prompt cannot be empty"):
        ai_service.generate_ai_response(
            system_prompt="   ",
            user_prompt=valid_prompts["user_prompt"],
        )


def test_rejects_empty_user_prompt(valid_prompts):
    with pytest.raises(ValueError, match="User prompt cannot be empty"):
        ai_service.generate_ai_response(
            system_prompt=valid_prompts["system_prompt"],
            user_prompt="   ",
        )


def test_rejects_non_string_prompts():
    with pytest.raises(ValueError):
        ai_service.generate_ai_response(
            system_prompt=None,
            user_prompt="Valid prompt",
        )

    with pytest.raises(ValueError):
        ai_service.generate_ai_response(
            system_prompt="Valid prompt",
            user_prompt=None,
        )


def test_rejects_system_prompt_over_limit(valid_prompts):
    oversized_prompt = "A" * (ai_service.MAX_SYSTEM_PROMPT_LENGTH + 1)

    with pytest.raises(ValueError, match="System prompt exceeds"):
        ai_service.generate_ai_response(
            system_prompt=oversized_prompt,
            user_prompt=valid_prompts["user_prompt"],
        )


def test_rejects_user_prompt_over_limit(valid_prompts):
    oversized_prompt = "A" * (ai_service.MAX_USER_PROMPT_LENGTH + 1)

    with pytest.raises(ValueError, match="User prompt exceeds"):
        ai_service.generate_ai_response(
            system_prompt=valid_prompts["system_prompt"],
            user_prompt=oversized_prompt,
        )


@pytest.mark.parametrize("token_limit", [0, -1, 4097, True, 1.5, "100"])
def test_rejects_invalid_output_token_limit(valid_prompts, token_limit):
    with pytest.raises(ValueError, match="Invalid AI output token limit"):
        ai_service.generate_ai_response(
            system_prompt=valid_prompts["system_prompt"],
            user_prompt=valid_prompts["user_prompt"],
            max_output_tokens=token_limit,
        )


def test_openai_provider_success(monkeypatch, valid_prompts):
    monkeypatch.setattr(ai_service, "AI_PROVIDER", "openai")

    def fake_openai(**kwargs):
        assert kwargs["system_prompt"] == valid_prompts["system_prompt"]
        assert kwargs["user_prompt"] == valid_prompts["user_prompt"]
        assert kwargs["max_output_tokens"] == 800
        return "Mocked OpenAI response"

    monkeypatch.setattr(ai_service, "generate_with_openai", fake_openai)

    result = ai_service.generate_ai_response(
        **valid_prompts
    )

    assert result == "Mocked OpenAI response"


def test_ollama_provider_success(monkeypatch, valid_prompts):
    monkeypatch.setattr(ai_service, "AI_PROVIDER", "ollama")
    monkeypatch.setattr(
        ai_service,
        "generate_with_ollama",
        lambda **kwargs: "Mocked Ollama response",
    )

    result = ai_service.generate_ai_response(
        **valid_prompts
    )

    assert result == "Mocked Ollama response"


def test_openai_unexpected_error_returns_controlled_error(
    monkeypatch,
    valid_prompts,
):
    monkeypatch.setattr(ai_service, "AI_PROVIDER", "openai")
    monkeypatch.setattr(ai_service, "AI_FALLBACK_TO_OLLAMA", False)

    def failing_openai(**kwargs):
        raise ValueError("Internal test error")

    monkeypatch.setattr(
        ai_service,
        "generate_with_openai",
        failing_openai,
    )

    with pytest.raises(
        RuntimeError,
        match="AI service is temporarily unavailable",
    ):
        ai_service.generate_ai_response(**valid_prompts)


def test_openai_failure_uses_configured_fallback(
    monkeypatch,
    valid_prompts,
):
    class FakeOpenAIError(Exception):
        pass

    monkeypatch.setattr(ai_service, "AI_PROVIDER", "openai")
    monkeypatch.setattr(ai_service, "AI_FALLBACK_TO_OLLAMA", True)
    monkeypatch.setattr(ai_service, "OpenAIError", FakeOpenAIError)
    monkeypatch.setattr(
        ai_service,
        "should_use_ollama_fallback",
        lambda error: True,
    )

    def failing_openai(**kwargs):
        raise FakeOpenAIError("Simulated provider failure")

    monkeypatch.setattr(
        ai_service,
        "generate_with_openai",
        failing_openai,
    )
    monkeypatch.setattr(
        ai_service,
        "generate_with_ollama",
        lambda **kwargs: "Mocked fallback response",
    )

    result = ai_service.generate_ai_response(**valid_prompts)

    assert result == "Mocked fallback response"


def test_openai_failure_does_not_fallback_when_disabled(
    monkeypatch,
    valid_prompts,
):
    class FakeOpenAIError(Exception):
        pass

    monkeypatch.setattr(ai_service, "AI_PROVIDER", "openai")
    monkeypatch.setattr(ai_service, "AI_FALLBACK_TO_OLLAMA", False)
    monkeypatch.setattr(ai_service, "OpenAIError", FakeOpenAIError)

    def failing_openai(**kwargs):
        raise FakeOpenAIError("Simulated provider failure")

    monkeypatch.setattr(
        ai_service,
        "generate_with_openai",
        failing_openai,
    )

    fallback_called = False

    def fake_ollama(**kwargs):
        nonlocal fallback_called
        fallback_called = True
        return "Unexpected fallback"

    monkeypatch.setattr(
        ai_service,
        "generate_with_ollama",
        fake_ollama,
    )

    with pytest.raises(
        RuntimeError,
        match="AI service is temporarily unavailable",
    ):
        ai_service.generate_ai_response(**valid_prompts)

    assert fallback_called is False


def test_openai_empty_response_is_rejected(monkeypatch):
    fake_client = SimpleNamespace(
        responses=SimpleNamespace(
            create=lambda **kwargs: SimpleNamespace(output_text="   ")
        )
    )

    monkeypatch.setattr(
        ai_service,
        "get_openai_client",
        lambda: fake_client,
    )

    with pytest.raises(RuntimeError, match="empty response"):
        ai_service.generate_with_openai(
            system_prompt="System",
            user_prompt="User",
            max_output_tokens=100,
        )


def test_unknown_provider_is_rejected(monkeypatch, valid_prompts):
    monkeypatch.setattr(ai_service, "AI_PROVIDER", "unknown")

    with pytest.raises(RuntimeError, match="AI provider configuration is invalid"):
        ai_service.generate_ai_response(**valid_prompts)
