import logging
import json
from datetime import datetime
from typing import Dict, Any, Optional
import os
from pathlib import Path

# Create logs directory if it doesn't exist
log_dir = Path("logs")
log_dir.mkdir(exist_ok=True)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_dir / "app.log"),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger("jcsbot")

class StructuredLogger:
    def __init__(self, logger: logging.Logger):
        self.logger = logger

    def _format_message(self, message: str, extra: Optional[Dict[str, Any]] = None) -> str:
        """Format message with extra context as JSON."""
        log_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "message": message,
            **(extra or {})
        }
        return json.dumps(log_data)

    def info(self, message: str, extra: Optional[Dict[str, Any]] = None):
        """Log info message with structured data."""
        self.logger.info(self._format_message(message, extra))

    def error(self, message: str, extra: Optional[Dict[str, Any]] = None):
        """Log error message with structured data."""
        self.logger.error(self._format_message(message, extra))

    def warning(self, message: str, extra: Optional[Dict[str, Any]] = None):
        """Log warning message with structured data."""
        self.logger.warning(self._format_message(message, extra))

    def debug(self, message: str, extra: Optional[Dict[str, Any]] = None):
        """Log debug message with structured data."""
        self.logger.debug(self._format_message(message, extra))

# Create structured logger instance
structured_logger = StructuredLogger(logger) 