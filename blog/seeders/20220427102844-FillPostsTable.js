'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {

        await queryInterface.bulkInsert('Posts', [
            {
                title: 'Primer Post',
                body: 'Esta práctica implementa un Blog.',
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                title: 'Segundo Post',
                body: 'Todo el mundo puede crear posts.',
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                title: 'Tercer Post',
                body: 'Cada post puede tener una imagen adjunta.',
                createdAt: new Date(),
                updatedAt: new Date()
            },
    
        ]);
    },

    down: async (queryInterface, Sequelize) => {

        await queryInterface.bulkDelete('Posts', null, {});
    }
};