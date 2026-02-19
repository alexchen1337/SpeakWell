from datetime import datetime

from sqlalchemy.orm import Session as DBSession

from app.models import Session


class SessionDAO:
    def create(self, db: DBSession, session: Session) -> Session:
        db.add(session)
        db.commit()
        return session

    def get_by_refresh_token_hash(self, db: DBSession, token_hash: str) -> Session | None:
        return db.query(Session).filter(
            Session.refresh_token == token_hash,
            Session.expires_at > datetime.utcnow(),
        ).first()

    def delete_by_refresh_token_hash(self, db: DBSession, token_hash: str) -> None:
        db.query(Session).filter(Session.refresh_token == token_hash).delete()
        db.commit()

    def update(self, db: DBSession, session: Session) -> None:
        db.commit()


session_dao = SessionDAO()
