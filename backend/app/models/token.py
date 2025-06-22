class Token(BaseModel):
    access_token: str
    token_type: str
    is_admin: bool = False