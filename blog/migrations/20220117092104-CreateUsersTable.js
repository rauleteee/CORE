'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('Users',
            {
                id: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    primaryKey: true,
                    autoIncrement: true,
                    unique: true
                },
                username: {
                    type: Sequelize.STRING,
                    unique: true,
                    validate: {
                        notEmpty: {msg: "Username must not be empty."}
                    }
                },
                password: {
                    type: Sequelize.STRING,
                    validate: {notEmpty: {msg: "Password must not be empty."}}
                },
                email: {
                    type: Sequelize.STRING,
                    validate: {
                        isEmail:{ msg: "Email must be in a correct format"}
                    }
                },
                salt: {
                    type: Sequelize.STRING
                },
                isAdmin: {
                    type: Sequelize.BOOLEAN,
                    defaultValue: false
                },
                createdAt: {
                    type: Sequelize.DATE,
                    allowNull: false
                },
                updatedAt: {
                    type: Sequelize.DATE,
                    allowNull: false
                }
            },
            {
                sync: {force: true}
            }
        );
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('Users');
    }
};
