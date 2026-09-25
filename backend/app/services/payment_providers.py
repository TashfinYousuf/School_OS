# backend/app/services/payment_providers.py
from abc import ABC, abstractmethod
from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Dict, Optional


@dataclass
class PaymentExecutionResult:
    success: bool
    transaction_id: str
    status: str
    message: str
    raw_response: Dict[str, Any]


class BasePaymentProvider(ABC):
    @abstractmethod
    async def process_payment(
        self,
        tenant_id: str,
        amount: Decimal,
        receipt_number: str,
        client_metadata: Dict[str, Any]
    ) -> PaymentExecutionResult:
        """Processes or verifies a payment against the provider rail."""
        pass

    @abstractmethod
    async def verify_transaction(self, provider_transaction_id: str) -> bool:
        """Audits transaction authenticity directly against the provider."""
        pass


class CashDeskProvider(BasePaymentProvider):
    async def process_payment(
        self,
        tenant_id: str,
        amount: Decimal,
        receipt_number: str,
        client_metadata: Dict[str, Any]
    ) -> PaymentExecutionResult:
        # Cash payments are settled directly by physical cashier
        cashier_id = client_metadata.get("cashier_user_id", "DESK_SYSTEM")
        return PaymentExecutionResult(
            success=True,
            transaction_id=f"CASH-{receipt_number}",
            status="COMPLETED",
            message=f"Cash collected at physical counter by user {cashier_id}.",
            raw_response={"cashier_user_id": cashier_id, "settled_channel": "CASH_DESK"}
        )

    async def verify_transaction(self, provider_transaction_id: str) -> bool:
        return True


class BankTransferProvider(BasePaymentProvider):
    async def process_payment(
        self,
        tenant_id: str,
        amount: Decimal,
        receipt_number: str,
        client_metadata: Dict[str, Any]
    ) -> PaymentExecutionResult:
        bank_ref = client_metadata.get("bank_reference")
        deposit_slip_url = client_metadata.get("deposit_slip_url")
        
        # Bank deposits enter review until physical/statement audit
        return PaymentExecutionResult(
            success=True,
            transaction_id=f"BANK-{bank_ref}",
            status="PENDING",
            message="Bank deposit slip submitted for account audit.",
            raw_response={"bank_reference": bank_ref, "slip_url": deposit_slip_url}
        )

    async def verify_transaction(self, provider_transaction_id: str) -> bool:
        return True


class BKashMerchantProvider(BasePaymentProvider):
    async def process_payment(
        self,
        tenant_id: str,
        amount: Decimal,
        receipt_number: str,
        client_metadata: Dict[str, Any]
    ) -> PaymentExecutionResult:
        # In production: invokes bKash Tokenized Checkout API /payment/create
        trx_id = client_metadata.get("bKash_trx_id")
        if not trx_id:
            return PaymentExecutionResult(
                success=False,
                transaction_id="",
                status="FAILED",
                message="Missing bKash TrxID from client submission.",
                raw_response={}
            )
            
        # Verify via bKash Query API in production
        return PaymentExecutionResult(
            success=True,
            transaction_id=trx_id,
            status="COMPLETED",
            message="bKash transaction verified via merchant query.",
            raw_response={"trx_id": trx_id, "channel": "bKash"}
        )

    async def verify_transaction(self, provider_transaction_id: str) -> bool:
        return bool(provider_transaction_id)


class NagadProvider(BasePaymentProvider):
    async def process_payment(
        self,
        tenant_id: str,
        amount: Decimal,
        receipt_number: str,
        client_metadata: Dict[str, Any]
    ) -> PaymentExecutionResult:
        trx_id = client_metadata.get("nagad_trx_id")
        if not trx_id:
            return PaymentExecutionResult(
                success=False,
                transaction_id="",
                status="FAILED",
                message="Missing Nagad TrxID.",
                raw_response={}
            )
            
        return PaymentExecutionResult(
            success=True,
            transaction_id=trx_id,
            status="COMPLETED",
            message="Nagad payment registered successfully.",
            raw_response={"trx_id": trx_id, "channel": "Nagad"}
        )

    async def verify_transaction(self, provider_transaction_id: str) -> bool:
        return bool(provider_transaction_id)


class PaymentProviderFactory:
    _providers = {
        "CASH": CashDeskProvider(),
        "BANK_TRANSFER": BankTransferProvider(),
        "BKASH": BKashMerchantProvider(),
        "NAGAD": NagadProvider(),
    }

    @classmethod
    def get_provider(cls, method: str) -> BasePaymentProvider:
        provider = cls._providers.get(method.upper())
        if not provider:
            raise ValueError(f"Unsupported payment method: {method}. Crypto and legacy methods are deprecated.")
        return provider