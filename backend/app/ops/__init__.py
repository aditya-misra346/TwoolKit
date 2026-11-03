"""Op registry: maps op names to handlers, accepted input types and timeouts."""

from __future__ import annotations

from dataclasses import dataclass, field

from ..jobs import BatchHandler, OpHandler
from . import data_ops, image_ops, office_ops, pdf_ops, security_ops


@dataclass(frozen=True)
class OpSpec:
    name: str
    accepts: frozenset[str]
    handler: OpHandler | None = None
    batch_handler: BatchHandler | None = None
    timeout_s: float = 900
    max_files: int | None = None
    secret_options: tuple[str, ...] = field(default_factory=tuple)


PDF = frozenset({"pdf"})
OFFICE = frozenset(office_ops.OFFICE_INPUTS)
IMAGES = frozenset({"jpeg", "png", "webp", "avif", "gif", "bmp", "tiff", "ico", "heic", "heif"})

OPS: dict[str, OpSpec] = {
    s.name: s
    for s in [
        OpSpec("pdf.to_docx", PDF, pdf_ops.to_docx, timeout_s=900, secret_options=("password",)),
        OpSpec("pdf.to_pptx", PDF, pdf_ops.to_pptx, secret_options=("password",)),
        OpSpec("pdf.to_xlsx", PDF, pdf_ops.to_xlsx, secret_options=("password",)),
        OpSpec("pdf.to_html", PDF, pdf_ops.to_html, secret_options=("password",)),
        OpSpec("pdf.to_svg", PDF, pdf_ops.to_svg, secret_options=("password",)),
        OpSpec("pdf.to_txt", PDF, pdf_ops.to_txt, secret_options=("password",)),
        OpSpec("pdf.compress", PDF, pdf_ops.compress, secret_options=("password",)),
        OpSpec("pdf.protect", PDF, pdf_ops.protect, secret_options=("userPassword", "ownerPassword")),
        OpSpec("pdf.unlock", PDF, pdf_ops.unlock, secret_options=("password",)),
        OpSpec("pdf.repair", PDF | {"unknown"}, pdf_ops.repair, secret_options=("password",)),
        OpSpec("pdf.extract_images", PDF, pdf_ops.extract_images, secret_options=("password",)),
        OpSpec("office.convert", OFFICE, office_ops.convert, timeout_s=600),
        OpSpec("office.to_images", OFFICE | PDF, office_ops.to_images, timeout_s=600),
        OpSpec("office.to_video", frozenset({"ppt", "pptx", "odp", "pdf"}), office_ops.to_video, timeout_s=900),
        OpSpec("data.convert", frozenset(data_ops.MATRIX), data_ops.convert, timeout_s=300),
        OpSpec("image.convert", IMAGES, image_ops.convert, timeout_s=300),
        OpSpec("image.remove_bg", frozenset({"jpeg", "png", "webp"}), image_ops.remove_bg, timeout_s=300),
        OpSpec("security.clamav", frozenset({"*"}), batch_handler=security_ops.clamav_scan, timeout_s=900),
    ]
}
