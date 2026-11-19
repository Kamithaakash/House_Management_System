#we use flyweight pattern in here to reduce the space

from enum import Enum

#safty cap add a maximum amount
MAX_AMOUNT_CENTS = 100_000_000

class Section(str, Enum):
    FOOD = "food"
    BOARDING_FEE = "boarding_fee"
    ELECTRIC_BILL = "electric_bill"
    WATER_BILL = "water_bill"
    MATERIAL = "material"

class FoodType(str, Enum):
    RICE_CURRY = "rice_curry"
    FRIED_RICE = "fried_rice"
    KOTTU = "kottu"
    OTHER = "other"
    
class CurryType(str, Enum):
    VEG = "veg"
    EGG = "egg"
    FISH = "fish"
    MEAT = "meat"
class SettlementStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
