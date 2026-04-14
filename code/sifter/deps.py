"""
FastAPI dependency providers for extension interfaces.
Override these in sifter-cloud via app.dependency_overrides.
"""
from .services.limits import NoopLimiter
from .services.email import NoopEmailSender


_noop_limiter = NoopLimiter()
_noop_email = NoopEmailSender()


def get_usage_limiter() -> NoopLimiter:
    """Returns the active UsageLimiter. Override in cloud with StripeLimiter."""
    return _noop_limiter


def get_email_sender() -> NoopEmailSender:
    """Returns the active EmailSender. Override in cloud with ResendEmailSender."""
    return _noop_email
