/**
 * PAI agreement compatibility client.
 *
 * PAI owns:
 * - agreement definition
 * - counterparties
 * - milestones
 * - acceptance
 * - delivery evidence
 * - agreement lifecycle
 *
 * The current implementation temporarily transports these
 * operations through the legacy mixed AgreementEscrow contract.
 * That transport can later be replaced without changing PAI UI.
 */
export function createPaiAgreementClient(contract) {
    if (!contract) {
        return null;
    }

    return {
        getAgreement(agreementId) {
            return contract.agreementById(
                agreementId
            );
        },

        getMilestone(
            agreementId,
            milestoneId
        ) {
            return contract.milestoneById(
                agreementId,
                milestoneId
            );
        },

        getNextAgreementId() {
            return contract.nextAgreementId();
        },

        createAgreement(
            contractor,
            paymentToken,
            metadataURI
        ) {
            return contract.createAgreement(
                contractor,
                paymentToken,
                metadataURI
            );
        },

        addMilestone(
            agreementId,
            amount,
            metadataURI
        ) {
            return contract.addMilestone(
                agreementId,
                amount,
                metadataURI
            );
        },

        acceptAgreement(agreementId) {
            return contract.acceptAgreement(
                agreementId
            );
        },

        submitMilestone(
            agreementId,
            milestoneId,
            evidenceURI,
            evidenceHash
        ) {
            return contract.submitMilestone(
                agreementId,
                milestoneId,
                evidenceURI,
                evidenceHash
            );
        },

        parseLog(log) {
            return contract.interface.parseLog(
                log
            );
        },
    };
}